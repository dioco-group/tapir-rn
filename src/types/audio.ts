/**
 * Audio-related types for Tapir
 */

// ============================================================================
// Voice Message Types (BLE Protocol)
// ============================================================================

export enum VoiceMessageType {
  VOICE_START = 0x60,
  VOICE_DATA = 0x61,
  VOICE_END = 0x62,
}

// ============================================================================
// Audio Device Types
// ============================================================================

export interface AudioDevice {
  address: string;
  name: string;
  type: 'a2dp' | 'headset' | 'hearing_aid' | 'le_audio';
  isConnected: boolean;
  isTapir: boolean;
}

export type RingerMode = 'normal' | 'vibrate' | 'silent';

export type AudioOutput =
  | 'phone_wired'      // Wired headphones in phone
  | 'tapir_wired'      // Wired headphones in Tapir
  | 'bt_headphones'    // Non-Tapir BT headphones
  | 'tapir_speaker'    // Tapir built-in speaker
  | 'phone_speaker';   // Phone built-in speaker

export type AudioContext = 'music' | 'call' | 'notification' | 'ai' | 'system';

// ============================================================================
// Voice Events
// ============================================================================

export interface VoiceEvent {
  type: 'start' | 'data' | 'end' | 'result' | 'error';
  sequence?: number;
  audio?: Uint8Array;
  text?: string;
  error?: string;
}

// ============================================================================
// Voice Data Packet (from device)
// ============================================================================

export interface VoiceDataPacket {
  sequence: number;
  timestamp: number;
  opusData: Uint8Array;
}

// ============================================================================
// Audio State
// ============================================================================

export interface AudioState {
  phoneWiredConnected: boolean;
  tapirWiredConnected: boolean;
  btHeadphones: { address: string; name: string } | null;
  tapirConnected: boolean;
  tapirAddress: string | null;
  screenOn: boolean;
  ringerMode: RingerMode;
}

// ============================================================================
// Native Module Types
// ============================================================================

export interface BluetoothAudioNativeModule {
  getConnectedDevices(): Promise<AudioDevice[]>;
  setActiveA2dpDevice(address: string | null): Promise<boolean>;
  isDeviceConnected(address: string): Promise<boolean>;
  isWiredHeadphonesConnected(): Promise<boolean>;
  getRingerMode(): Promise<RingerMode>;
  isScreenOn(): Promise<boolean>;
  startBluetoothSco(): Promise<boolean>;
  stopBluetoothSco(): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

// ============================================================================
// Haptic Patterns
// ============================================================================

export type HapticPattern = 
  | 'tap'           // Single light tap
  | 'double'        // Double tap
  | 'buzz'          // Short buzz
  | 'notification'  // Notification pattern
  | 'ring'          // Repeating ring pattern
  | 'alarm';        // Alarm pattern

