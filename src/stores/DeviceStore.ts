/**
 * DeviceStore - MobX store for device connection state
 * 
 * Manages:
 * - Connection state machine
 * - Scanned devices list
 * - Connected device info
 * - Battery level and RSSI
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { Platform, PermissionsAndroid } from 'react-native';
import { bleService, storageService } from '../services';
import {
  ConnectionState,
  ScannedDevice,
  MessageType,
  KeyEvent,
  ReceivedMessage,
} from '../types/protocol';

class DeviceStore {
  // Connection state
  connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  
  // Scanned devices
  scannedDevices: Map<string, ScannedDevice> = new Map();
  
  // Connected device info
  connectedDeviceId: string | null = null;
  connectedDeviceName: string | null = null;
  mtu: number = 23;
  rssi: number | null = null;
  batteryLevel: number | null = null;
  
  // Error state
  error: string | null = null;
  
  // Key event callback
  private onKeypressCallback: ((keyIndex: number, event: KeyEvent) => void) | null = null;

  constructor() {
    makeAutoObservable(this);
    
    // Set up BLE callbacks
    bleService.onMessage(this.handleMessage.bind(this));
    bleService.onDisconnect(this.handleDisconnect.bind(this));
  }

  // ==========================================================================
  // Computed
  // ==========================================================================

  get isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED ||
           this.connectionState === ConnectionState.READY;
  }

  get isScanning(): boolean {
    return this.connectionState === ConnectionState.SCANNING;
  }

  get scannedDevicesList(): ScannedDevice[] {
    return Array.from(this.scannedDevices.values())
      .sort((a, b) => (b.rssi ?? -100) - (a.rssi ?? -100)); // Sort by signal strength
  }

  get statusText(): string {
    switch (this.connectionState) {
      case ConnectionState.DISCONNECTED:
        return 'Disconnected';
      case ConnectionState.SCANNING:
        return 'Scanning...';
      case ConnectionState.CONNECTING:
        return 'Connecting...';
      case ConnectionState.CONNECTED:
        return 'Connected';
      case ConnectionState.READY:
        return `Ready (MTU: ${this.mtu})`;
      default:
        return 'Unknown';
    }
  }

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Request Bluetooth permissions (Android 12+)
   */
  private async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = 
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

        if (!allGranted) {
          console.warn('[DeviceStore] Bluetooth permissions not granted:', granted);
        }
        
        return allGranted;
      } else {
        // Android < 12 only needs location for BLE scanning
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Tapir needs location permission for Bluetooth scanning',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (error) {
      console.error('[DeviceStore] Permission request error:', error);
      return false;
    }
  }

  /**
   * Start scanning for devices
   */
  async startScan(): Promise<void> {
    if (this.connectionState !== ConnectionState.DISCONNECTED) {
      return;
    }

    // Request permissions first
    const hasPermissions = await this.requestBluetoothPermissions();
    if (!hasPermissions) {
      runInAction(() => {
        this.error = 'Bluetooth permissions not granted';
      });
      return;
    }

    runInAction(() => {
      this.connectionState = ConnectionState.SCANNING;
      this.scannedDevices.clear();
      this.error = null;
    });

    try {
      await bleService.startScan((device) => {
        runInAction(() => {
          this.scannedDevices.set(device.id, device);
        });
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : String(err);
      });
    } finally {
      runInAction(() => {
        if (this.connectionState === ConnectionState.SCANNING) {
          this.connectionState = ConnectionState.DISCONNECTED;
        }
      });
    }
  }

  /**
   * Stop scanning
   */
  stopScan(): void {
    bleService.stopScan();
    runInAction(() => {
      if (this.connectionState === ConnectionState.SCANNING) {
        this.connectionState = ConnectionState.DISCONNECTED;
      }
    });
  }

  /**
   * Connect to a device
   */
  async connect(deviceId: string): Promise<void> {
    if (this.isConnected) {
      await this.disconnect();
    }

    runInAction(() => {
      this.connectionState = ConnectionState.CONNECTING;
      this.error = null;
    });

    try {
      const { mtu } = await bleService.connect(deviceId);

      runInAction(() => {
        this.connectionState = ConnectionState.READY;
        this.connectedDeviceId = deviceId;
        this.connectedDeviceName = this.scannedDevices.get(deviceId)?.name ?? null;
        this.mtu = mtu;
      });

      // Save as last connected device
      storageService.setLastConnectedDevice(deviceId);

    } catch (err) {
      runInAction(() => {
        this.connectionState = ConnectionState.DISCONNECTED;
        this.error = err instanceof Error ? err.message : String(err);
      });
      throw err;
    }
  }

  /**
   * Disconnect from current device
   */
  async disconnect(): Promise<void> {
    await bleService.disconnect();
    this.handleDisconnect();
  }

  /**
   * Auto-connect to last known device
   */
  async autoConnect(): Promise<boolean> {
    if (!storageService.getAutoConnect()) {
      return false;
    }

    const lastDevice = storageService.getLastConnectedDevice();
    if (!lastDevice) {
      return false;
    }

    try {
      await this.connect(lastDevice);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set keypress callback
   */
  onKeypress(callback: (keyIndex: number, event: KeyEvent) => void): void {
    this.onKeypressCallback = callback;
  }

  // ==========================================================================
  // Private
  // ==========================================================================

  private handleMessage(msg: ReceivedMessage): void {
    switch (msg.type) {
      case MessageType.KEYPRESS:
        if (msg.payload.length >= 2) {
          const keyIndex = msg.payload[0];
          const event = msg.payload[1] as KeyEvent;
          this.onKeypressCallback?.(keyIndex, event);
        }
        break;
        
      case MessageType.ACK:
        console.log('[DeviceStore] Received ACK');
        break;
        
      case MessageType.SENSOR:
        // Handle sensor data (future)
        console.log('[DeviceStore] Received sensor data:', msg.payload);
        break;
    }
  }

  private handleDisconnect(): void {
    runInAction(() => {
      this.connectionState = ConnectionState.DISCONNECTED;
      this.connectedDeviceId = null;
      this.connectedDeviceName = null;
      this.mtu = 23;
      this.rssi = null;
      this.batteryLevel = null;
    });
  }
}

// Export singleton
export const deviceStore = new DeviceStore();

