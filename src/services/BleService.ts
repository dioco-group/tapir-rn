/**
 * BLE Service - Core Bluetooth Low Energy functionality
 * 
 * Handles:
 * - Device scanning
 * - Connection management with MTU negotiation
 * - Connection priority (high for speed)
 * - Write queue with pacing (prevents GATT busy errors)
 * - Notification subscriptions
 * - Message encoding/decoding per SiFli Serial Protocol
 */

import { BleManager, Device, Characteristic, ConnectionPriority } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import {
  BLE_SERIAL_SERVICE_UUID,
  BLE_SERIAL_DATA_CHAR_UUID,
  CATEGORY_ID,
  PacketFlag,
  MessageType,
  ReceivedMessage,
  ScannedDevice,
} from '../types/protocol';
import { voiceService } from './VoiceService';

// ============================================================================
// Constants
// ============================================================================

const MAX_CHUNK_SIZE = 506; // Safe: 506 + 4 header = 510 < 512
const DEFAULT_MTU = 23;
const TARGET_MTU = 517; // Request high MTU for speed
const WRITE_TIMEOUT_MS = 5000;
const SCAN_TIMEOUT_MS = 10000;

// ============================================================================
// Write Queue Item
// ============================================================================

interface WriteQueueItem {
  data: Uint8Array;
  resolve: () => void;
  reject: (error: Error) => void;
  timestamp: number;
}

// ============================================================================
// BLE Service Singleton
// ============================================================================

class BleService {
  private manager: BleManager;
  private device: Device | null = null;
  private dataCharacteristic: Characteristic | null = null;
  private mtu: number = DEFAULT_MTU;
  
  // Write queue for pacing
  private writeQueue: WriteQueueItem[] = [];
  private isWriting: boolean = false;
  
  // Callbacks
  private onMessageCallback: ((msg: ReceivedMessage) => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onScanResultCallback: ((device: ScannedDevice) => void) | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start scanning for Tapir devices
   */
  async startScan(onDevice: (device: ScannedDevice) => void): Promise<void> {
    this.onScanResultCallback = onDevice;

    // Check Bluetooth state
    const state = await this.manager.state();
    console.log('[BLE] Bluetooth state:', state);
    if (state !== 'PoweredOn') {
      throw new Error(`Bluetooth is not ready: ${state}`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('[BLE] Scan timeout reached');
        this.stopScan();
        resolve();
      }, SCAN_TIMEOUT_MS);

      console.log('[BLE] Starting scan for service:', BLE_SERIAL_SERVICE_UUID);
      
      // Scan for devices - first try with service filter, fallback to all devices
      this.manager.startDeviceScan(
        null, // Scan ALL devices (service filter can miss some devices)
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('[BLE] Scan error:', error);
            clearTimeout(timeout);
            reject(error);
            return;
          }
          
          if (device) {
            // Log all devices for debugging
            if (device.name) {
              console.log('[BLE] Found device:', device.name, device.id);
            }
            
            // Filter for Tapir devices (by name prefix or service UUID)
            const isTapir = device.name?.toUpperCase().includes('TAPIR') ||
                           device.localName?.toUpperCase().includes('TAPIR');
            
            if (isTapir && this.onScanResultCallback) {
              console.log('[BLE] Found Tapir device:', device.name);
              this.onScanResultCallback({
                id: device.id,
                name: device.name,
                localName: device.localName,
                rssi: device.rssi,
              });
            }
          }
        }
      );
    });
  }

  /**
   * Stop scanning
   */
  stopScan(): void {
    this.manager.stopDeviceScan();
    this.onScanResultCallback = null;
  }

  /**
   * Connect to a device by ID
   */
  async connect(deviceId: string): Promise<{ mtu: number }> {
    // Stop scanning if active
    this.stopScan();

    // Connect to device
    console.log(`[BLE] Connecting to ${deviceId}...`);
    this.device = await this.manager.connectToDevice(deviceId, {
      requestMTU: TARGET_MTU,
      timeout: 10000,
    });

    // Set up disconnect listener
    this.device.onDisconnected((error, device) => {
      console.log(`[BLE] Disconnected from ${device?.id}`, error);
      this.cleanup();
      this.onDisconnectCallback?.();
    });

    // Discover services
    console.log('[BLE] Discovering services...');
    await this.device.discoverAllServicesAndCharacteristics();

    // Get negotiated MTU
    const deviceMtu = this.device.mtu;
    this.mtu = deviceMtu ?? DEFAULT_MTU;
    console.log(`[BLE] MTU: ${this.mtu}`);

    // Request high connection priority for speed
    console.log('[BLE] Requesting high connection priority...');
    await this.device.requestConnectionPriority(ConnectionPriority.High);

    // Get data characteristic
    const characteristics = await this.device.characteristicsForService(
      BLE_SERIAL_SERVICE_UUID
    );
    
    this.dataCharacteristic = characteristics.find(
      (c) => c.uuid.toLowerCase() === BLE_SERIAL_DATA_CHAR_UUID.toLowerCase()
    ) ?? null;

    if (!this.dataCharacteristic) {
      throw new Error('Data characteristic not found');
    }

    // Start notifications
    console.log('[BLE] Starting notifications...');
    await this.startNotifications();

    console.log('[BLE] Ready!');
    return { mtu: this.mtu };
  }

  /**
   * Disconnect from current device
   */
  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch (error) {
        // Ignore errors during disconnect
      }
    }
    this.cleanup();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.device !== null && this.dataCharacteristic !== null;
  }

  /**
   * Get current MTU
   */
  getMtu(): number {
    return this.mtu;
  }

  /**
   * Get connected device ID
   */
  getDeviceId(): string | null {
    return this.device?.id ?? null;
  }

  // ==========================================================================
  // Message Sending
  // ==========================================================================

  /**
   * Send a message to the device
   */
  async sendMessage(type: MessageType, payload: Uint8Array = new Uint8Array(0)): Promise<void> {
    const message = new Uint8Array(1 + payload.length);
    message[0] = type;
    if (payload.length > 0) {
      message.set(payload, 1);
    }
    await this.sendSerialData(message);
  }

  /**
   * Send LED control command
   */
  async sendLedControl(keyIndex: number, r: number, g: number, b: number): Promise<void> {
    const payload = new Uint8Array([keyIndex, r, g, b]);
    await this.sendMessage(MessageType.LED, payload);
  }

  /**
   * Send terminal screen update
   */
  async sendTerminalScreen(cols: number, rows: number, screenData: Uint8Array): Promise<void> {
    const payload = new Uint8Array(2 + screenData.length);
    payload[0] = cols;
    payload[1] = rows;
    payload.set(screenData, 2);
    await this.sendMessage(MessageType.FULL_SCREEN, payload);
  }

  /**
   * Send terminal clear command
   */
  async sendTerminalClear(): Promise<void> {
    await this.sendMessage(MessageType.CLEAR_SCREEN);
  }

  /**
   * Send echo test (device echoes back)
   */
  async sendEcho(data: string | Uint8Array): Promise<void> {
    const payload = typeof data === 'string' 
      ? new TextEncoder().encode(data) 
      : data;
    await this.sendMessage(MessageType.ECHO, payload);
  }

  /**
   * Send discard test (for speed testing)
   */
  async sendDiscard(size: number): Promise<void> {
    const payload = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      payload[i] = i & 0xff;
    }
    await this.sendMessage(MessageType.DISCARD, payload);
  }

  /**
   * Send haptic pattern to device
   */
  async sendHaptic(pattern: number): Promise<void> {
    const payload = new Uint8Array([pattern]);
    await this.sendMessage(MessageType.HAPTIC, payload);
  }

  /**
   * Public API for sending raw messages by type
   */
  async send(type: number, payload: Uint8Array = new Uint8Array(0)): Promise<void> {
    await this.sendMessage(type as MessageType, payload);
  }

  // ==========================================================================
  // Callbacks
  // ==========================================================================

  /**
   * Set callback for received messages
   */
  onMessage(callback: (msg: ReceivedMessage) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Set callback for disconnect events
   */
  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  // ==========================================================================
  // Private: Serial Data Layer
  // ==========================================================================

  /**
   * Send raw serial data with automatic chunking and queuing
   */
  private async sendSerialData(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({
        data,
        resolve,
        reject,
        timestamp: Date.now(),
      });
      
      // Process queue if not already writing
      if (!this.isWriting) {
        this.processWriteQueue();
      }
    });
  }

  /**
   * Process the write queue one item at a time
   */
  private async processWriteQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    while (this.writeQueue.length > 0) {
      const item = this.writeQueue.shift()!;
      
      // Check for timeout
      if (Date.now() - item.timestamp > WRITE_TIMEOUT_MS) {
        item.reject(new Error('Write timeout'));
        continue;
      }

      try {
        await this.doSendSerialData(item.data);
        item.resolve();
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isWriting = false;
  }

  /**
   * Actually send the data with fragmentation
   */
  private async doSendSerialData(data: Uint8Array): Promise<void> {
    if (!this.dataCharacteristic) {
      throw new Error('Not connected');
    }

    // Single packet if small enough
    if (data.length <= MAX_CHUNK_SIZE) {
      const packet = new Uint8Array(4 + data.length);
      packet[0] = CATEGORY_ID;
      packet[1] = PacketFlag.COMPLETE;
      packet[2] = data.length & 0xff;
      packet[3] = (data.length >> 8) & 0xff;
      packet.set(data, 4);
      
      await this.dataCharacteristic.writeWithoutResponse(
        Buffer.from(packet).toString('base64')
      );
      return;
    }

    // Fragment large data
    let offset = 0;
    let isFirst = true;

    while (offset < data.length) {
      const remaining = data.length - offset;
      const isLast = remaining <= MAX_CHUNK_SIZE;

      let flag: PacketFlag;
      let headerSize: number;
      let chunkSize: number;

      if (isFirst) {
        flag = PacketFlag.FIRST;
        headerSize = 4; // catId + flag + 2-byte length
        chunkSize = Math.min(remaining, MAX_CHUNK_SIZE);
        isFirst = false;
      } else if (isLast) {
        flag = PacketFlag.LAST;
        headerSize = 2; // catId + flag only
        chunkSize = remaining;
      } else {
        flag = PacketFlag.CONTINUE;
        headerSize = 2; // catId + flag only
        chunkSize = MAX_CHUNK_SIZE;
      }

      const packet = new Uint8Array(headerSize + chunkSize);
      packet[0] = CATEGORY_ID;
      packet[1] = flag;

      if (flag === PacketFlag.FIRST) {
        // First packet includes total length
        packet[2] = data.length & 0xff;
        packet[3] = (data.length >> 8) & 0xff;
        packet.set(data.subarray(offset, offset + chunkSize), 4);
      } else {
        // Continuation packets have no length field
        packet.set(data.subarray(offset, offset + chunkSize), 2);
      }

      await this.dataCharacteristic.writeWithoutResponse(
        Buffer.from(packet).toString('base64')
      );
      offset += chunkSize;
    }
  }

  // ==========================================================================
  // Private: Notifications
  // ==========================================================================

  /**
   * Start listening for notifications
   */
  private async startNotifications(): Promise<void> {
    if (!this.dataCharacteristic) {
      throw new Error('Not connected');
    }

    this.dataCharacteristic.monitor((error, characteristic) => {
      if (error) {
        console.error('[BLE] Notification error:', error);
        return;
      }

      if (characteristic?.value) {
        this.handleNotification(characteristic.value);
      }
    });
  }

  /**
   * Handle incoming notification
   */
  private handleNotification(base64Value: string): void {
    const value = Buffer.from(base64Value, 'base64');
    
    if (value.length < 4) {
      console.warn('[BLE] Received packet too short');
      return;
    }

    const categoryId = value[0];
    const flag = value[1];
    const length = value[2] | (value[3] << 8);

    // Extract payload
    const payload = new Uint8Array(value.subarray(4));

    // TODO: Handle fragmented packets
    if (flag !== PacketFlag.COMPLETE) {
      console.warn(`[BLE] Fragmented packets not yet supported (flag: ${flag})`);
      return;
    }

    // Parse message: [MSG_TYPE][PAYLOAD...]
    if (payload.length >= 1) {
      const msgType = payload[0] as MessageType;
      const msgPayload = payload.subarray(1);

      // Handle voice messages directly (high priority, low latency)
      if (this.handleVoiceMessage(msgType, msgPayload)) {
        return;
      }

      const message: ReceivedMessage = {
        type: msgType,
        payload: new Uint8Array(msgPayload),
      };

      console.log(`[BLE] Received: type=0x${msgType.toString(16)}, len=${msgPayload.length}`);
      
      this.onMessageCallback?.(message);
    }
  }

  // ==========================================================================
  // Private: Voice Message Handling
  // ==========================================================================

  /**
   * Handle voice messages from device (PTT)
   * Returns true if message was handled
   */
  private handleVoiceMessage(msgType: MessageType, payload: Uint8Array): boolean {
    switch (msgType) {
      case MessageType.VOICE_START:
        console.log('[BLE] Voice start received');
        voiceService.handleVoiceStart();
        return true;

      case MessageType.VOICE_DATA:
        // Forward raw payload to voice service
        voiceService.handleVoiceData(new Uint8Array(payload));
        return true;

      case MessageType.VOICE_END:
        console.log('[BLE] Voice end received');
        voiceService.handleVoiceEnd();
        return true;

      case MessageType.AUDIO_HEADPHONES:
        // Device reporting headphone jack state
        const connected = payload[0] === 1;
        console.log('[BLE] Tapir headphones:', connected ? 'connected' : 'disconnected');
        // Notify audio routing service
        import('./AudioRoutingService').then(({ audioRoutingService }) => {
          audioRoutingService.setTapirHeadphonesConnected(connected);
        });
        return true;

      default:
        return false;
    }
  }

  // ==========================================================================
  // Private: Cleanup
  // ==========================================================================

  private cleanup(): void {
    this.device = null;
    this.dataCharacteristic = null;
    this.mtu = DEFAULT_MTU;
    this.writeQueue = [];
    this.isWriting = false;
  }

  /**
   * Destroy the BLE manager (call on app shutdown)
   */
  destroy(): void {
    this.cleanup();
    this.manager.destroy();
  }
}

// Export singleton instance
export const bleService = new BleService();

