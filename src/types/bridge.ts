/**
 * WebView Bridge Protocol Types
 * 
 * Defines the communication interface between Mini-Apps (WebView)
 * and the Native runtime.
 */

// ============================================================================
// Bridge Request Types (JS → Native)
// ============================================================================

export type BridgeMethod =
  | 'led'
  | 'terminal'
  | 'terminalClear'
  | 'echo'
  | 'ai.chat'
  | 'storage.get'
  | 'storage.set'
  | 'tts.speak'
  | 'device.info'
  | 'device.vibrate'
  | 'launcher.launch'
  | 'launcher.home'
  | 'launcher.back'
  | 'launcher.getApps'
  | 'launcher.updateApp'
  // Voice
  | 'voice.speak'
  | 'voice.status'
  // Audio
  | 'audio.status'
  | 'audio.alert';

export interface BridgeRequest {
  id: string;
  method: BridgeMethod;
  params: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// LED Control
// ============================================================================

export interface LedControlParams {
  index: number;
  r: number;
  g: number;
  b: number;
}

// ============================================================================
// Terminal Control
// ============================================================================

export interface TerminalUpdateParams {
  /** Base64-encoded screen buffer */
  buffer: string;
  cols?: number;
  rows?: number;
}

// ============================================================================
// AI Chat (Proxied API call)
// ============================================================================

export interface AiChatParams {
  prompt: string;
  model?: string;
  maxTokens?: number;
}

export interface AiChatResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// ============================================================================
// Storage
// ============================================================================

export interface StorageGetParams {
  key: string;
}

export interface StorageSetParams {
  key: string;
  value: string;
}

// ============================================================================
// TTS
// ============================================================================

export interface TtsSpeakParams {
  text: string;
  language?: string;
  rate?: number;
}

// ============================================================================
// Bridge Events (Native → JS)
// ============================================================================

export type BridgeEventType =
  | 'button'
  | 'notification'
  | 'connection'
  | 'sensor'
  | 'voice.start'
  | 'voice.result'
  | 'voice.end';

export interface BridgeEvent {
  type: BridgeEventType;
  data: Record<string, unknown>;
}

export interface ButtonEvent {
  type: 'button';
  data: {
    id: number;
    event: 'down' | 'up';
  };
}

export interface NotificationEvent {
  type: 'notification';
  data: {
    app: string;
    title: string;
    text: string;
    timestamp: number;
  };
}

export interface ConnectionEvent {
  type: 'connection';
  data: {
    state: 'connected' | 'disconnected' | 'ready';
    deviceId?: string;
  };
}

// ============================================================================
// Launcher Types
// ============================================================================

export interface LauncherLaunchParams {
  index: number;
}

export interface LauncherUpdateAppParams {
  index: number;
  name?: string;
  icon?: string;
  url?: string;
  enabled?: boolean;
}

// ============================================================================
// Voice (PTT) Events
// ============================================================================

export interface VoiceStartEvent {
  type: 'voice.start';
  data: Record<string, never>;
}

export interface VoiceResultEvent {
  type: 'voice.result';
  data: {
    transcript: string;
    response: string;
  };
}

export interface VoiceEndEvent {
  type: 'voice.end';
  data: {
    state: 'idle' | 'processing' | 'speaking';
  };
}

