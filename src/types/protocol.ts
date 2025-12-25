/**
 * BLE Serial Transfer Protocol Types
 * 
 * Based on SiFli Serial Transfer Service protocol.
 * Service UUID: 00000000-0000-0000-6473-5f696c666973
 */

// ============================================================================
// BLE Service UUIDs
// ============================================================================

export const BLE_SERIAL_SERVICE_UUID = '00000000-0000-0000-6473-5f696c666973';
export const BLE_SERIAL_CONFIG_CHAR_UUID = '00000000-0000-0100-6473-5f696c666973';
export const BLE_SERIAL_DATA_CHAR_UUID = '00000000-0000-0200-6473-5f696c666973';

// Category ID for our application
export const CATEGORY_ID = 0x1f;

// ============================================================================
// Packet Fragmentation Flags
// ============================================================================

export enum PacketFlag {
  COMPLETE = 0x00,
  FIRST = 0x01,
  CONTINUE = 0x02,
  LAST = 0x03,
}

// ============================================================================
// Message Types
// ============================================================================

export enum MessageType {
  // Device → App (firmware sends these)
  KEYPRESS = 0x10,
  SENSOR = 0x11,
  ACK = 0x12,

  // App → Device
  LED = 0x20,
  CONFIG = 0x21,
  REQUEST = 0x22,

  // Test/Debug
  ECHO = 0x30,
  DISCARD = 0x31,

  // Terminal
  FULL_SCREEN = 0x40,
  CLEAR_SCREEN = 0x41,
  FULL_SCREEN_ATTRS = 0x42, // Future: with color attributes
  CURSOR_POS = 0x43,        // Future
  PARTIAL_UPDATE = 0x44,    // Future
}

// ============================================================================
// Key Events
// ============================================================================

export enum KeyEvent {
  DOWN = 1,
  UP = 2,
}

// ============================================================================
// Message Payloads
// ============================================================================

export interface KeypressPayload {
  keyIndex: number;
  event: KeyEvent;
}

export interface LedPayload {
  keyIndex: number;
  r: number;
  g: number;
  b: number;
}

export interface TerminalScreenPayload {
  cols: number;
  rows: number;
  data: Uint8Array;
}

export interface ReceivedMessage {
  type: MessageType;
  payload: Uint8Array;
}

// ============================================================================
// Connection States
// ============================================================================

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  SCANNING = 'scanning',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  READY = 'ready', // Connected + MTU negotiated + notifications enabled
}

// ============================================================================
// Device Info
// ============================================================================

export interface ScannedDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  localName: string | null;
}

export interface ConnectedDevice {
  id: string;
  name: string | null;
  mtu: number;
  rssi: number | null;
}

