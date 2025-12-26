# Audio Implementation Strategy

Detailed implementation plan for audio features in the Tapir React Native app.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     TAPIR RN APP                                │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Audio      │  │  Voice      │  │  Bluetooth              │ │
│  │  Routing    │  │  Service    │  │  Audio Module           │ │
│  │  Service    │  │  (PTT/STT)  │  │  (Native)               │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                     │               │
│         └────────────────┼─────────────────────┘               │
│                          │                                      │
│                    ┌─────┴─────┐                               │
│                    │  Bridge   │                               │
│                    │  Handler  │                               │
│                    └───────────┘                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Native Bluetooth Audio Module

### Purpose
Control which Bluetooth device receives audio and detect connected devices.

### Files to Create

```
android/app/src/main/java/com/tapir/runtime/
└── audio/
    ├── BluetoothAudioModule.kt      # React Native module
    ├── BluetoothAudioPackage.kt     # Package registration
    └── AudioDeviceListener.kt       # Device change listener
```

### API

```typescript
// NativeModules.BluetoothAudio

interface BluetoothAudioModule {
  // Get all connected audio devices
  getConnectedDevices(): Promise<AudioDevice[]>;
  
  // Set active A2DP device (for music)
  setActiveA2dpDevice(address: string | null): Promise<void>;
  
  // Check if specific device is connected
  isDeviceConnected(address: string): Promise<boolean>;
  
  // Start/stop SCO (for calls, backup option)
  startSco(): Promise<void>;
  stopSco(): Promise<void>;
  
  // Events
  addListener(event: 'deviceConnected' | 'deviceDisconnected', callback): void;
  addListener(event: 'headphonesChanged', callback): void;
}

interface AudioDevice {
  address: string;
  name: string;
  type: 'a2dp' | 'headset' | 'hearing_aid' | 'le_audio';
  isConnected: boolean;
  isTapir: boolean;  // We detect this by name
}
```

### Implementation (Kotlin)

```kotlin
// BluetoothAudioModule.kt
class BluetoothAudioModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    private val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
    private var a2dpProxy: BluetoothA2dp? = null

    override fun getName() = "BluetoothAudio"

    override fun initialize() {
        // Get A2DP proxy
        bluetoothAdapter.getProfileProxy(
            reactApplicationContext,
            object : BluetoothProfile.ServiceListener {
                override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                    if (profile == BluetoothProfile.A2DP) {
                        a2dpProxy = proxy as BluetoothA2dp
                    }
                }
                override fun onServiceDisconnected(profile: Int) {
                    if (profile == BluetoothProfile.A2DP) {
                        a2dpProxy = null
                    }
                }
            },
            BluetoothProfile.A2DP
        )
        
        // Register for headphone changes
        val filter = IntentFilter().apply {
            addAction(AudioManager.ACTION_HEADSET_PLUG)
            addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED)
        }
        reactApplicationContext.registerReceiver(audioReceiver, filter)
    }

    @ReactMethod
    fun getConnectedDevices(promise: Promise) {
        val devices = mutableListOf<WritableMap>()
        
        a2dpProxy?.connectedDevices?.forEach { device ->
            val map = Arguments.createMap().apply {
                putString("address", device.address)
                putString("name", device.name)
                putString("type", "a2dp")
                putBoolean("isConnected", true)
                putBoolean("isTapir", device.name?.contains("TAPIR", true) == true)
            }
            devices.add(map)
        }
        
        promise.resolve(Arguments.createArray().apply {
            devices.forEach { pushMap(it) }
        })
    }

    @ReactMethod
    fun setActiveA2dpDevice(address: String?, promise: Promise) {
        try {
            if (address == null) {
                // Clear active device - use phone speaker
                a2dpProxy?.javaClass?.getMethod("setActiveDevice", BluetoothDevice::class.java)
                    ?.invoke(a2dpProxy, null)
            } else {
                val device = bluetoothAdapter.getRemoteDevice(address)
                a2dpProxy?.javaClass?.getMethod("setActiveDevice", BluetoothDevice::class.java)
                    ?.invoke(a2dpProxy, device)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private val audioReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                AudioManager.ACTION_HEADSET_PLUG -> {
                    val plugged = intent.getIntExtra("state", 0) == 1
                    sendEvent("headphonesChanged", Arguments.createMap().apply {
                        putBoolean("connected", plugged)
                        putString("type", "wired")
                    })
                }
                BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED -> {
                    val state = intent.getIntExtra(BluetoothProfile.EXTRA_STATE, -1)
                    val device = intent.getParcelableExtra<BluetoothDevice>(BluetoothDevice.EXTRA_DEVICE)
                    val event = if (state == BluetoothProfile.STATE_CONNECTED) 
                        "deviceConnected" else "deviceDisconnected"
                    sendEvent(event, Arguments.createMap().apply {
                        putString("address", device?.address)
                        putString("name", device?.name)
                    })
                }
            }
        }
    }
}
```

---

## Phase 2: Audio Routing Service

### Purpose
Determine where audio should play based on connected devices and phone state.

### Files to Create

```
src/services/
└── AudioRoutingService.ts
```

### Implementation

```typescript
// src/services/AudioRoutingService.ts

import { AppState, NativeEventEmitter, NativeModules } from 'react-native';
import { makeAutoObservable, runInAction } from 'mobx';
import { deviceStore } from '../stores';

const { BluetoothAudio } = NativeModules;
const audioEvents = new NativeEventEmitter(BluetoothAudio);

export type AudioOutput = 
  | 'phone_wired'      // Wired headphones in phone
  | 'tapir_wired'      // Wired headphones in Tapir
  | 'bt_headphones'    // Non-Tapir BT headphones
  | 'tapir_speaker'    // Tapir built-in speaker
  | 'phone_speaker';   // Phone built-in speaker

interface AudioState {
  phoneWiredConnected: boolean;
  tapirWiredConnected: boolean;
  btHeadphones: { address: string; name: string } | null;
  tapirConnected: boolean;
  tapirAddress: string | null;
  screenOn: boolean;
}

class AudioRoutingService {
  state: AudioState = {
    phoneWiredConnected: false,
    tapirWiredConnected: false,
    btHeadphones: null,
    tapirConnected: false,
    tapirAddress: null,
    screenOn: true,
  };

  constructor() {
    makeAutoObservable(this);
    this.setupListeners();
  }

  private setupListeners() {
    // Screen state
    AppState.addEventListener('change', (appState) => {
      runInAction(() => {
        this.state.screenOn = appState === 'active';
      });
      this.updateRouting();
    });

    // Phone wired headphones
    audioEvents.addListener('headphonesChanged', ({ connected, type }) => {
      if (type === 'wired') {
        runInAction(() => {
          this.state.phoneWiredConnected = connected;
        });
        this.updateRouting();
      }
    });

    // BT devices
    audioEvents.addListener('deviceConnected', ({ address, name }) => {
      runInAction(() => {
        if (name?.toUpperCase().includes('TAPIR')) {
          this.state.tapirConnected = true;
          this.state.tapirAddress = address;
        } else {
          this.state.btHeadphones = { address, name };
        }
      });
      this.updateRouting();
    });

    audioEvents.addListener('deviceDisconnected', ({ address }) => {
      runInAction(() => {
        if (address === this.state.tapirAddress) {
          this.state.tapirConnected = false;
          this.state.tapirAddress = null;
        } else if (address === this.state.btHeadphones?.address) {
          this.state.btHeadphones = null;
        }
      });
      this.updateRouting();
    });

    // Tapir headphone jack (from BLE)
    deviceStore.onEvent?.('audio.headphones', ({ connected }) => {
      runInAction(() => {
        this.state.tapirWiredConnected = connected;
      });
      this.updateRouting();
    });
  }

  /**
   * Determine best output based on current state
   */
  getRoute(context: 'music' | 'ai' | 'notification' = 'music'): AudioOutput {
    const s = this.state;

    // Priority 1: Phone wired headphones
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

    // Priority 4: Context-dependent
    if (context === 'ai') {
      // AI always goes to Tapir speaker if connected
      return s.tapirConnected ? 'tapir_speaker' : 'phone_speaker';
    }

    if (context === 'notification') {
      // Notifications go to Tapir if connected
      return s.tapirConnected ? 'tapir_speaker' : 'phone_speaker';
    }

    // Music: depends on screen state
    if (s.screenOn) {
      return 'phone_speaker';
    } else {
      return s.tapirConnected ? 'tapir_speaker' : 'phone_speaker';
    }
  }

  /**
   * Update active A2DP device based on routing decision
   */
  private async updateRouting() {
    const route = this.getRoute('music');

    try {
      switch (route) {
        case 'tapir_wired':
        case 'tapir_speaker':
          // Route to Tapir
          if (this.state.tapirAddress) {
            await BluetoothAudio.setActiveA2dpDevice(this.state.tapirAddress);
          }
          break;

        case 'bt_headphones':
          // Route to other BT headphones
          if (this.state.btHeadphones) {
            await BluetoothAudio.setActiveA2dpDevice(this.state.btHeadphones.address);
          }
          break;

        case 'phone_wired':
        case 'phone_speaker':
        default:
          // Route to phone (clear BT active device)
          await BluetoothAudio.setActiveA2dpDevice(null);
          break;
      }
    } catch (error) {
      console.error('[AudioRouting] Failed to update routing:', error);
    }
  }

  /**
   * Get current routing state for debugging
   */
  getStatus() {
    return {
      ...this.state,
      currentRoute: this.getRoute('music'),
    };
  }
}

export const audioRoutingService = new AudioRoutingService();
```

---

## Phase 3: Voice Service (PTT)

### Purpose
Handle PTT button press, receive voice audio over BLE, decode, and process.

### Files to Create

```
src/services/
├── VoiceService.ts          # Main voice handling
└── OpusDecoder.ts           # Opus decoding wrapper

src/types/
└── audio.ts                 # Audio-related types
```

### Dependencies to Add

```bash
npm install opus-decoder  # Web/JS Opus decoder
# or
npm install @peerbit/opus-js
```

### Types

```typescript
// src/types/audio.ts

export enum VoiceMessageType {
  VOICE_START = 0x60,
  VOICE_DATA = 0x61,
  VOICE_END = 0x62,
}

export interface VoiceDataPacket {
  type: VoiceMessageType.VOICE_DATA;
  sequence: number;
  data: Uint8Array;
}

export interface VoiceEvent {
  type: 'start' | 'data' | 'end' | 'result' | 'error';
  sequence?: number;
  audio?: Uint8Array;
  text?: string;
  error?: string;
}
```

### Implementation

```typescript
// src/services/VoiceService.ts

import { makeAutoObservable, runInAction } from 'mobx';
import { bleService } from './BleService';
import { VoiceMessageType, VoiceEvent } from '../types/audio';

// Opus decoder (using Web Audio API compatible decoder)
import { OpusDecoder } from './OpusDecoder';

class VoiceService {
  isRecording: boolean = false;
  isProcessing: boolean = false;
  lastTranscript: string = '';
  
  private decoder: OpusDecoder | null = null;
  private audioChunks: Float32Array[] = [];
  private expectedSequence: number = 0;
  private listeners: ((event: VoiceEvent) => void)[] = [];

  constructor() {
    makeAutoObservable(this);
    this.setupBleListener();
  }

  private setupBleListener() {
    bleService.onMessage((msg) => {
      switch (msg.type) {
        case VoiceMessageType.VOICE_START:
          this.handleVoiceStart();
          break;
        case VoiceMessageType.VOICE_DATA:
          this.handleVoiceData(msg.payload);
          break;
        case VoiceMessageType.VOICE_END:
          this.handleVoiceEnd();
          break;
      }
    });
  }

  private async handleVoiceStart() {
    console.log('[Voice] Recording started');
    
    runInAction(() => {
      this.isRecording = true;
    });
    
    // Initialize decoder
    this.decoder = new OpusDecoder({
      sampleRate: 16000,
      channels: 1,
    });
    await this.decoder.init();
    
    this.audioChunks = [];
    this.expectedSequence = 0;
    
    this.emit({ type: 'start' });
  }

  private async handleVoiceData(payload: Uint8Array) {
    if (!this.decoder || !this.isRecording) return;
    
    // Parse packet: [seq_hi, seq_lo, opus_data...]
    const sequence = (payload[0] << 8) | payload[1];
    const opusFrame = payload.slice(2);
    
    // Check sequence (warn on gaps, but continue)
    if (sequence !== this.expectedSequence) {
      console.warn(`[Voice] Sequence gap: expected ${this.expectedSequence}, got ${sequence}`);
    }
    this.expectedSequence = (sequence + 1) & 0xFFFF;
    
    // Decode Opus frame to PCM
    try {
      const pcm = await this.decoder.decode(opusFrame);
      this.audioChunks.push(pcm);
      
      this.emit({ type: 'data', sequence, audio: opusFrame });
    } catch (error) {
      console.error('[Voice] Decode error:', error);
    }
  }

  private async handleVoiceEnd() {
    console.log('[Voice] Recording ended, processing...');
    
    runInAction(() => {
      this.isRecording = false;
      this.isProcessing = true;
    });
    
    this.emit({ type: 'end' });
    
    try {
      // Combine all PCM chunks
      const totalLength = this.audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of this.audioChunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Send to STT
      const transcript = await this.transcribe(combined);
      
      runInAction(() => {
        this.lastTranscript = transcript;
        this.isProcessing = false;
      });
      
      this.emit({ type: 'result', text: transcript });
      
    } catch (error) {
      console.error('[Voice] Processing error:', error);
      runInAction(() => {
        this.isProcessing = false;
      });
      this.emit({ type: 'error', error: String(error) });
    }
    
    // Cleanup
    this.decoder?.destroy();
    this.decoder = null;
    this.audioChunks = [];
  }

  /**
   * Transcribe audio using STT
   */
  private async transcribe(audio: Float32Array): Promise<string> {
    // Option 1: Whisper API
    // Convert to WAV/blob, send to OpenAI Whisper
    
    // Option 2: On-device STT (Android SpeechRecognizer)
    // Would need native module
    
    // For now, use Whisper API
    const wavBlob = this.pcmToWav(audio);
    return await this.whisperTranscribe(wavBlob);
  }

  private pcmToWav(pcm: Float32Array): Blob {
    // Convert Float32 PCM to WAV format
    const sampleRate = 16000;
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit
    
    const buffer = new ArrayBuffer(44 + pcm.length * bytesPerSample);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcm.length * bytesPerSample, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true);  // AudioFormat (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeString(36, 'data');
    view.setUint32(40, pcm.length * bytesPerSample, true);
    
    // Convert Float32 to Int16
    const int16 = new Int16Array(buffer, 44);
    for (let i = 0; i < pcm.length; i++) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  private async whisperTranscribe(audio: Blob): Promise<string> {
    const { vaultStore } = await import('../stores');
    
    if (!vaultStore.hasOpenAiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    const formData = new FormData();
    formData.append('file', audio, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vaultStore.openAiKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }
    
    const result = await response.json();
    return result.text;
  }

  /**
   * Subscribe to voice events
   */
  onEvent(callback: (event: VoiceEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private emit(event: VoiceEvent) {
    this.listeners.forEach(l => l(event));
  }
}

export const voiceService = new VoiceService();
```

---

## Phase 4: Bridge Integration

### Add to BridgeHandler

```typescript
// src/bridge/BridgeHandler.ts - additions

import { voiceService } from '../services/VoiceService';
import { audioRoutingService } from '../services/AudioRoutingService';

// In handleMethod switch:

case 'voice.speak':
  return this.handleVoiceSpeak(params);

case 'audio.getRouting':
  return audioRoutingService.getStatus();

// New method:
private async handleVoiceSpeak(params: { text: string; context?: string }): Promise<void> {
  const { text, context = 'ai' } = params;
  
  // TTS uses expo-speech, routing is automatic via Android
  // If Tapir is active A2DP device, audio goes there
  await Speech.speak(text, {
    language: 'en-US',
    onDone: () => console.log('[Voice] TTS complete'),
  });
}
```

### Add Bridge Events for Voice

```typescript
// Forward voice events to WebView
voiceService.onEvent((event) => {
  bridgeHandler.emitEvent({
    type: 'voice',
    data: event,
  });
});
```

---

## Phase 5: Protocol Updates

### Add to protocol.ts

```typescript
// src/types/protocol.ts - additions

export enum MessageType {
  // ... existing types ...
  
  // Voice
  VOICE_START = 0x60,
  VOICE_DATA = 0x61,
  VOICE_END = 0x62,
  
  // Audio control
  AUDIO_HEADPHONES = 0x63,  // Device reports headphone state
  HAPTIC = 0x64,            // Trigger LRA pattern
}

export interface VoiceStartMessage {
  type: MessageType.VOICE_START;
}

export interface VoiceDataMessage {
  type: MessageType.VOICE_DATA;
  sequence: number;
  data: Uint8Array;
}

export interface VoiceEndMessage {
  type: MessageType.VOICE_END;
}

export interface AudioHeadphonesMessage {
  type: MessageType.AUDIO_HEADPHONES;
  connected: boolean;
}
```

---

## Phase 6: Testing

### Test Cases

1. **Audio Routing**
   - Connect Tapir, verify it becomes active A2DP
   - Turn screen off, verify audio routes to Tapir
   - Turn screen on, verify audio routes to phone
   - Connect other BT headphones, verify they take priority
   - Plug in phone headphones, verify they take priority

2. **PTT Voice**
   - Press KEY2 on device, verify VOICE_START received
   - Speak, verify VOICE_DATA packets received with correct sequence
   - Release KEY2, verify VOICE_END received
   - Verify Opus decoding produces valid audio
   - Verify Whisper transcription returns text

3. **AI Flow**
   - PTT → speak → release → transcript → AI → TTS
   - Verify TTS plays on Tapir speaker

---

## Files Summary

| File | Purpose | Phase |
|------|---------|-------|
| `android/.../BluetoothAudioModule.kt` | Native BT audio control | 1 |
| `android/.../BluetoothAudioPackage.kt` | RN package registration | 1 |
| `src/services/AudioRoutingService.ts` | Audio routing logic | 2 |
| `src/services/VoiceService.ts` | PTT voice handling | 3 |
| `src/services/OpusDecoder.ts` | Opus decoding | 3 |
| `src/types/audio.ts` | Audio types | 3 |
| `src/bridge/BridgeHandler.ts` | Bridge additions | 4 |
| `src/types/protocol.ts` | Protocol additions | 5 |

---

## Dependencies to Add

```bash
# For Opus decoding
npm install opus-decoder

# Already have (verify):
# expo-speech - TTS
# expo-av - Audio playback (if needed)
```

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| 1. Native BT Module | 2-3 days | None |
| 2. Audio Routing | 1-2 days | Phase 1 |
| 3. Voice Service | 2-3 days | Phase 1, Opus decoder |
| 4. Bridge Integration | 0.5 day | Phases 2, 3 |
| 5. Protocol Updates | 0.5 day | None |
| 6. Testing | 1-2 days | All |

**Total: ~7-11 days**

---

## Definition of Done

- [ ] Native BluetoothAudioModule implemented and working
- [ ] Audio routes to Tapir when screen off
- [ ] Audio routes to phone when screen on
- [ ] Wired headphones take priority
- [ ] PTT voice packets received and decoded
- [ ] Whisper transcription working
- [ ] AI response plays via TTS
- [ ] TTS routes to Tapir speaker
- [ ] All test cases passing

