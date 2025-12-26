/**
 * VoiceService - Handles PTT voice streaming over BLE
 * 
 * Receives Opus-encoded audio from device, sends to Whisper for STT,
 * then AI for response, then TTS for speech output.
 * 
 * Flow: Device Mic → Opus → BLE → VoiceService → Whisper → AI → TTS → Speaker
 */

import { makeAutoObservable, runInAction } from 'mobx';
import * as Speech from 'expo-speech';
import { VoiceDataPacket, VoiceSession } from '../types/protocol';
import { vaultStore } from '../stores/VaultStore';

// ============================================================================
// Types
// ============================================================================

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceResult {
  transcript: string;
  response: string;
}

// ============================================================================
// VoiceService
// ============================================================================

class VoiceService {
  // State
  state: VoiceState = 'idle';
  currentSession: VoiceSession | null = null;
  lastResult: VoiceResult | null = null;
  
  // Raw opus data buffer (sent to cloud for decoding)
  private opusBuffer: Uint8Array[] = [];
  
  // Callbacks
  private onTranscript: ((text: string) => void) | null = null;
  private onResponse: ((text: string) => void) | null = null;
  private onStateChange: ((state: VoiceState) => void) | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  // ==========================================================================
  // Event Handlers (called by BleService)
  // ==========================================================================

  /**
   * Called when VOICE_START (0x60) received
   */
  handleVoiceStart(): void {
    console.log('[VoiceService] Voice stream started');
    
    runInAction(() => {
      this.state = 'listening';
      this.currentSession = {
        startTime: Date.now(),
        packets: [],
        ended: false,
      };
    });
    
    this.decoder.reset();
    this.pcmBuffer = [];
    this.onStateChange?.('listening');
  }

  /**
   * Called when VOICE_DATA (0x61) received
   */
  handleVoiceData(payload: Uint8Array): void {
    if (!this.currentSession || this.state !== 'listening') {
      console.warn('[VoiceService] Received voice data without active session');
      return;
    }

    // Parse packet: [seq_hi, seq_lo, opus_data...]
    if (payload.length < 3) {
      console.warn('[VoiceService] Invalid voice data packet');
      return;
    }

    const sequence = (payload[0] << 8) | payload[1];
    const opusData = payload.slice(2);

    const packet: VoiceDataPacket = { sequence, opusData };
    this.currentSession.packets.push(packet);

    // Decode and buffer PCM
    try {
      const pcm = this.decoder.decode(opusData);
      this.pcmBuffer.push(pcm);
    } catch (err) {
      console.error('[VoiceService] Decode error:', err);
    }

    console.log(`[VoiceService] Received packet ${sequence}, ${opusData.length} bytes`);
  }

  /**
   * Called when VOICE_END (0x62) received
   */
  async handleVoiceEnd(): Promise<void> {
    console.log('[VoiceService] Voice stream ended');
    
    if (!this.currentSession) {
      return;
    }

    runInAction(() => {
      this.currentSession!.ended = true;
      this.state = 'processing';
    });
    
    this.onStateChange?.('processing');

    // Process the audio
    await this.processVoiceSession();
  }

  // ==========================================================================
  // Processing Pipeline
  // ==========================================================================

  private async processVoiceSession(): Promise<void> {
    if (!this.currentSession) return;

    const session = this.currentSession;
    console.log(`[VoiceService] Processing ${session.packets.length} packets`);

    try {
      // Step 1: Combine PCM buffers
      const totalSamples = this.pcmBuffer.reduce((sum, buf) => sum + buf.length, 0);
      const combinedPcm = new Int16Array(totalSamples);
      let offset = 0;
      for (const buf of this.pcmBuffer) {
        combinedPcm.set(buf, offset);
        offset += buf.length;
      }

      // Step 2: Send to STT
      const transcript = await this.speechToText(combinedPcm);
      console.log('[VoiceService] Transcript:', transcript);
      this.onTranscript?.(transcript);

      // Step 3: Send to AI (if we have a transcript)
      if (transcript && transcript.trim()) {
        const response = await this.getAiResponse(transcript);
        console.log('[VoiceService] AI Response:', response);
        this.onResponse?.(response);

        // Step 4: Speak response
        runInAction(() => {
          this.state = 'speaking';
        });
        this.onStateChange?.('speaking');

        await this.speakResponse(response);

        runInAction(() => {
          this.lastResult = { transcript, response };
        });
      }
    } catch (err) {
      console.error('[VoiceService] Processing error:', err);
    } finally {
      runInAction(() => {
        this.state = 'idle';
        this.currentSession = null;
      });
      this.onStateChange?.('idle');
      this.pcmBuffer = [];
    }
  }

  /**
   * Convert PCM audio to text using STT
   */
  private async speechToText(pcm: Int16Array): Promise<string> {
    // TODO: Implement actual STT
    // Options:
    // 1. Send to Whisper API (OpenAI)
    // 2. Use on-device STT (expo-speech doesn't have STT)
    // 3. Use @react-native-voice/voice (but it expects mic input, not PCM)
    
    // For now, return placeholder
    console.warn('[VoiceService] STT not implemented - using placeholder');
    return '[STT not implemented]';
  }

  /**
   * Get AI response for transcript
   */
  private async getAiResponse(transcript: string): Promise<string> {
    // TODO: Use vaultStore.chatCompletion or similar
    // For now, echo back
    console.warn('[VoiceService] AI not connected - using echo');
    return `You said: ${transcript}`;
  }

  /**
   * Speak response using TTS
   */
  private async speakResponse(text: string): Promise<void> {
    return new Promise((resolve) => {
      Speech.speak(text, {
        language: 'en-US',
        onDone: () => resolve(),
        onError: () => resolve(),
      });
    });
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Register callback for transcription results
   */
  onTranscriptReceived(callback: (text: string) => void): void {
    this.onTranscript = callback;
  }

  /**
   * Register callback for AI responses
   */
  onResponseReceived(callback: (text: string) => void): void {
    this.onResponse = callback;
  }

  /**
   * Register callback for state changes
   */
  onVoiceStateChange(callback: (state: VoiceState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Cancel current voice session
   */
  cancel(): void {
    Speech.stop();
    runInAction(() => {
      this.state = 'idle';
      this.currentSession = null;
    });
    this.pcmBuffer = [];
  }
}

export const voiceService = new VoiceService();

