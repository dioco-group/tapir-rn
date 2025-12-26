/**
 * AudioRoutingService
 * 
 * Determines where audio should play based on connected devices and phone state.
 * Manages automatic routing between phone speaker, Tapir speaker, and headphones.
 */

import { AppState, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { makeAutoObservable, runInAction } from 'mobx';
import { 
  AudioState, 
  AudioOutput, 
  AudioContext, 
  RingerMode,
  BluetoothAudioNativeModule,
  HapticPattern
} from '../types/audio';

const BluetoothAudio = NativeModules.BluetoothAudio as BluetoothAudioNativeModule | undefined;

class AudioRoutingService {
  state: AudioState = {
    phoneWiredConnected: false,
    tapirWiredConnected: false,
    btHeadphones: null,
    tapirConnected: false,
    tapirAddress: null,
    screenOn: true,
    ringerMode: 'normal',
  };

  private eventEmitter: NativeEventEmitter | null = null;
  private isInitialized = false;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Initialize the service - call this after native modules are ready
   */
  async init(): Promise<void> {
    if (this.isInitialized || Platform.OS !== 'android') {
      return;
    }

    if (!BluetoothAudio) {
      console.warn('[AudioRouting] BluetoothAudio native module not available');
      return;
    }

    console.log('[AudioRouting] Initializing...');
    
    this.eventEmitter = new NativeEventEmitter(NativeModules.BluetoothAudio);
    this.setupListeners();
    await this.fetchInitialState();
    
    this.isInitialized = true;
    console.log('[AudioRouting] Initialized:', this.state);
  }

  private async fetchInitialState(): Promise<void> {
    if (!BluetoothAudio) return;

    try {
      // Get initial ringer mode
      const ringerMode = await BluetoothAudio.getRingerMode();
      
      // Get wired headphone state
      const phoneWiredConnected = await BluetoothAudio.isWiredHeadphonesConnected();
      
      // Get screen state
      const screenOn = await BluetoothAudio.isScreenOn();
      
      // Get connected BT devices
      const devices = await BluetoothAudio.getConnectedDevices();
      
      runInAction(() => {
        this.state.ringerMode = ringerMode;
        this.state.phoneWiredConnected = phoneWiredConnected;
        this.state.screenOn = screenOn;
        
        // Find Tapir and other BT headphones
        for (const device of devices) {
          if (device.isTapir) {
            this.state.tapirConnected = true;
            this.state.tapirAddress = device.address;
          } else {
            this.state.btHeadphones = { address: device.address, name: device.name };
          }
        }
      });
      
    } catch (error) {
      console.error('[AudioRouting] Failed to fetch initial state:', error);
    }
  }

  private setupListeners(): void {
    if (!this.eventEmitter) return;

    // Screen state changes
    AppState.addEventListener('change', (appState) => {
      runInAction(() => {
        this.state.screenOn = appState === 'active';
      });
      this.updateRouting();
    });

    // Phone wired headphones
    this.eventEmitter.addListener('headphonesChanged', ({ connected, type }) => {
      if (type === 'wired') {
        runInAction(() => {
          this.state.phoneWiredConnected = connected;
        });
        this.updateRouting();
      }
    });

    // BT device connected
    this.eventEmitter.addListener('deviceConnected', ({ address, name, isTapir }) => {
      runInAction(() => {
        if (isTapir) {
          this.state.tapirConnected = true;
          this.state.tapirAddress = address;
        } else {
          this.state.btHeadphones = { address, name };
        }
      });
      this.updateRouting();
    });

    // BT device disconnected
    this.eventEmitter.addListener('deviceDisconnected', ({ address }) => {
      runInAction(() => {
        if (address === this.state.tapirAddress) {
          this.state.tapirConnected = false;
          this.state.tapirAddress = null;
          this.state.tapirWiredConnected = false;
        } else if (address === this.state.btHeadphones?.address) {
          this.state.btHeadphones = null;
        }
      });
      this.updateRouting();
    });

    // Ringer mode changes
    this.eventEmitter.addListener('ringerModeChanged', ({ mode }) => {
      runInAction(() => {
        this.state.ringerMode = mode as RingerMode;
      });
    });
  }

  /**
   * Update Tapir headphone jack state (called from BLE service)
   */
  setTapirHeadphonesConnected(connected: boolean): void {
    runInAction(() => {
      this.state.tapirWiredConnected = connected;
    });
    this.updateRouting();
  }

  /**
   * Determine best audio output based on current state and context
   */
  getRoute(context: AudioContext = 'music'): AudioOutput {
    const s = this.state;

    // Priority 1: Phone wired headphones always win
    if (s.phoneWiredConnected) {
      return 'phone_wired';
    }

    // Priority 2: Tapir wired headphones
    if (s.tapirConnected && s.tapirWiredConnected) {
      return 'tapir_wired';
    }

    // Priority 3: Non-Tapir BT headphones
    if (s.btHeadphones) {
      return 'bt_headphones';
    }

    // Priority 4: Context-dependent speaker selection
    switch (context) {
      case 'ai':
        // AI responses always go to Tapir speaker (walkie-talkie UX)
        return s.tapirConnected ? 'tapir_speaker' : 'phone_speaker';

      case 'notification':
        // Notifications go to Tapir if connected
        return s.tapirConnected ? 'tapir_speaker' : 'phone_speaker';

      case 'call':
        // Calls prefer Tapir for hands-free
        return s.tapirConnected ? 'tapir_speaker' : 'phone_speaker';

      case 'music':
      case 'system':
      default:
        // Music: depends on screen state
        // Screen on = phone speaker (user is looking at phone)
        // Screen off = Tapir speaker (phone in pocket)
        if (s.screenOn) {
          return 'phone_speaker';
        } else {
          return s.tapirConnected ? 'tapir_speaker' : 'phone_speaker';
        }
    }
  }

  /**
   * Update active A2DP device based on routing decision
   */
  private async updateRouting(): Promise<void> {
    if (!BluetoothAudio) return;

    const route = this.getRoute('music');
    console.log('[AudioRouting] Updating route to:', route);

    try {
      switch (route) {
        case 'tapir_wired':
        case 'tapir_speaker':
          // Route audio to Tapir
          if (this.state.tapirAddress) {
            await BluetoothAudio.setActiveA2dpDevice(this.state.tapirAddress);
          }
          break;

        case 'bt_headphones':
          // Route audio to other BT headphones
          if (this.state.btHeadphones) {
            await BluetoothAudio.setActiveA2dpDevice(this.state.btHeadphones.address);
          }
          break;

        case 'phone_wired':
        case 'phone_speaker':
        default:
          // Route audio to phone (clear BT active device)
          await BluetoothAudio.setActiveA2dpDevice(null);
          break;
      }
    } catch (error) {
      console.error('[AudioRouting] Failed to update routing:', error);
    }
  }

  /**
   * Handle notification alert - respects ringer mode
   * Returns what actions were taken
   */
  async alertNotification(): Promise<{ sound: boolean; haptic: boolean }> {
    const { ringerMode, tapirConnected } = this.state;

    switch (ringerMode) {
      case 'silent':
        // No sound, no haptic
        return { sound: false, haptic: false };

      case 'vibrate':
        // Haptic only
        if (tapirConnected) {
          await this.sendHaptic('notification');
        }
        return { sound: false, haptic: true };

      case 'normal':
      default:
        // Sound + haptic
        if (tapirConnected) {
          await this.sendHaptic('notification');
        }
        // Sound plays via A2DP to active device
        return { sound: true, haptic: true };
    }
  }

  /**
   * Send haptic pattern to Tapir device
   */
  async sendHaptic(pattern: HapticPattern): Promise<void> {
    if (!this.state.tapirConnected) return;
    
    // Import BleService dynamically to avoid circular dependency
    const { bleService } = await import('./BleService');
    
    // Haptic command: type 0x64, payload is pattern ID
    const patternIds: Record<HapticPattern, number> = {
      'tap': 0x01,
      'double': 0x02,
      'buzz': 0x03,
      'notification': 0x04,
      'ring': 0x05,
      'alarm': 0x06,
    };
    
    const payload = new Uint8Array([patternIds[pattern]]);
    await bleService.send(0x64, payload); // HAPTIC message type
  }

  /**
   * Speak text via TTS, routed appropriately
   */
  async speak(text: string, context: AudioContext = 'ai'): Promise<void> {
    // Ensure routing is set correctly for this context
    const route = this.getRoute(context);
    console.log('[AudioRouting] Speaking via:', route);
    
    // Use expo-speech for TTS
    // The audio will route to the active A2DP device automatically
    const Speech = await import('expo-speech');
    
    await new Promise<void>((resolve, reject) => {
      Speech.speak(text, {
        language: 'en-US',
        onDone: () => resolve(),
        onError: (error) => reject(error),
      });
    });
  }

  /**
   * Get current state for debugging/UI
   */
  getStatus() {
    return {
      ...this.state,
      currentRoute: this.getRoute('music'),
      isInitialized: this.isInitialized,
    };
  }
}

export const audioRoutingService = new AudioRoutingService();

