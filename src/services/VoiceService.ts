/**
 * VoiceService - Handles PTT voice streaming over BLE
 * 
 * Receives Opus-encoded audio from device, decodes it,
 * sends to Whisper for STT, then AI for response, then TTS for speech output.
 * 
 * Flow: Device Mic → Opus → BLE → VoiceService → Decode → Whisper → AI → TTS → Speaker
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { VoiceEvent, VoiceDataPacket, VoiceMessageType } from '../types/audio';

// ============================================================================
// Types
// ============================================================================

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceSession {
  startTime: number;
  packets: VoiceDataPacket[];
  ended: boolean;
}

export interface VoiceResult {
  transcript: string;
  response: string;
}

// ============================================================================
// Simple Opus Decoder Stub
// ============================================================================

/**
 * OpusDecoder - Decodes Opus frames to PCM
 * 
 * Note: For production, we would use:
 * - opus-decoder npm package (WASM-based)
 * - Or send raw Opus to server for decoding
 * 
 * For now, this is a stub that will be replaced.
 */
class OpusDecoder {
  private sampleRate: number;
  private channels: number;

  constructor(sampleRate = 16000, channels = 1) {
    this.sampleRate = sampleRate;
    this.channels = channels;
  }

  async init(): Promise<void> {
    console.log('[OpusDecoder] Initialized (stub)');
  }

  reset(): void {
    // Reset decoder state
  }

  /**
   * Decode Opus frame to PCM samples
   * Returns Int16Array of PCM samples
   */
  decode(opusFrame: Uint8Array): Int16Array {
    // Stub: Return silence
    // In production, this would use libopus via WASM
    // Each Opus frame at 16kHz is typically 20ms = 320 samples
    const samplesPerFrame = (this.sampleRate * 20) / 1000; // 320 samples for 16kHz
    return new Int16Array(samplesPerFrame);
  }

  destroy(): void {
    // Cleanup
  }
}

// ============================================================================
// VoiceService
// ============================================================================

class VoiceService {
  // Observable state
  state: VoiceState = 'idle';
  currentSession: VoiceSession | null = null;
  lastResult: VoiceResult | null = null;
  
  // Opus decoder
  private decoder = new OpusDecoder();
  
  // Accumulated PCM samples
  private pcmBuffer: Int16Array[] = [];
  
  // Raw Opus data (for sending to Whisper API which can accept Opus)
  private opusFrames: Uint8Array[] = [];
  
  // Expected sequence number for gap detection
  private expectedSequence = 0;
  
  // Event listeners
  private listeners: ((event: VoiceEvent) => void)[] = [];
  
  // Callbacks (legacy support)
  private onTranscript: ((text: string) => void) | null = null;
  private onResponse: ((text: string) => void) | null = null;
  private onStateChange: ((state: VoiceState) => void) | null = null;

  constructor() {
    makeAutoObservable(this);
    this.decoder.init();
  }

  // ==========================================================================
  // Event Handlers (called by BleService when messages received)
  // ==========================================================================

  /**
   * Called when VOICE_START (0x60) received from device
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
    
    // Reset buffers
    this.decoder.reset();
    this.pcmBuffer = [];
    this.opusFrames = [];
    this.expectedSequence = 0;
    
    this.emit({ type: 'start' });
    this.onStateChange?.('listening');
  }

  /**
   * Called when VOICE_DATA (0x61) received from device
   */
  handleVoiceData(payload: Uint8Array): void {
    if (!this.currentSession || this.state !== 'listening') {
      console.warn('[VoiceService] Received voice data without active session');
      return;
    }

    // Parse packet: [seq_hi, seq_lo, timestamp_4bytes, opus_data...]
    if (payload.length < 6) {
      console.warn('[VoiceService] Invalid voice data packet (too short)');
      return;
    }

    const sequence = (payload[0] << 8) | payload[1];
    const timestamp = (payload[2] | (payload[3] << 8) | (payload[4] << 16) | (payload[5] << 24));
    const opusData = payload.slice(6);

    // Check for sequence gaps
    if (sequence !== this.expectedSequence) {
      const gap = sequence - this.expectedSequence;
      console.warn(`[VoiceService] Sequence gap: expected ${this.expectedSequence}, got ${sequence} (gap: ${gap})`);
    }
    this.expectedSequence = (sequence + 1) & 0xFFFF;

    // Store packet
    const packet: VoiceDataPacket = { 
      sequence, 
      timestamp,
      opusData 
    };
    this.currentSession.packets.push(packet);
    this.opusFrames.push(opusData);

    // Decode Opus to PCM
    try {
      const pcm = this.decoder.decode(opusData);
      this.pcmBuffer.push(pcm);
    } catch (err) {
      console.error('[VoiceService] Opus decode error:', err);
    }

    this.emit({ type: 'data', sequence, audio: opusData });
  }

  /**
   * Called when VOICE_END (0x62) received from device
   */
  async handleVoiceEnd(): Promise<void> {
    console.log('[VoiceService] Voice stream ended');
    
    if (!this.currentSession) {
      return;
    }

    const session = this.currentSession;
    const duration = Date.now() - session.startTime;
    console.log(`[VoiceService] Session: ${session.packets.length} packets, ${duration}ms`);

    runInAction(() => {
      this.currentSession!.ended = true;
      this.state = 'processing';
    });
    
    this.emit({ type: 'end' });
    this.onStateChange?.('processing');

    // Process the accumulated audio
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
      // Step 1: Combine PCM buffers into single array
      const totalSamples = this.pcmBuffer.reduce((sum, buf) => sum + buf.length, 0);
      const combinedPcm = new Int16Array(totalSamples);
      let offset = 0;
      for (const buf of this.pcmBuffer) {
        combinedPcm.set(buf, offset);
        offset += buf.length;
      }

      console.log(`[VoiceService] Combined PCM: ${totalSamples} samples (${totalSamples / 16000}s)`);

      // Step 2: Send to STT
      const transcript = await this.speechToText(combinedPcm);
      console.log('[VoiceService] Transcript:', transcript);
      
      this.onTranscript?.(transcript);
      this.emit({ type: 'result', text: transcript });

      // Step 3: Send to AI (if we have a meaningful transcript)
      if (transcript && transcript.trim() && !transcript.includes('[')) {
        const response = await this.getAiResponse(transcript);
        console.log('[VoiceService] AI Response:', response);
        this.onResponse?.(response);

        // Step 4: Speak response via TTS
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
      this.emit({ type: 'error', error: String(err) });
    } finally {
      runInAction(() => {
        this.state = 'idle';
        this.currentSession = null;
      });
      this.onStateChange?.('idle');
      this.pcmBuffer = [];
      this.opusFrames = [];
    }
  }

  /**
   * Convert PCM audio to text using Whisper API
   */
  private async speechToText(pcm: Int16Array): Promise<string> {
    // Import stores for API key access
    const { vaultStore } = await import('../stores/VaultStore');
    const { storageService } = await import('./StorageService');
    
    if (!vaultStore.hasOpenAiKey) {
      console.warn('[VoiceService] No OpenAI API key configured');
      return '[No API key - STT unavailable]';
    }

    const apiKey = storageService.getOpenAiKey();
    if (!apiKey) {
      return '[No API key - STT unavailable]';
    }

    try {
      // Convert PCM to WAV blob
      const wavBlob = this.pcmToWav(pcm);
      
      // Send to Whisper API
      const formData = new FormData();
      formData.append('file', wavBlob as any, 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return result.text || '';
    } catch (err) {
      console.error('[VoiceService] STT error:', err);
      return '[STT error]';
    }
  }

  /**
   * Convert Int16 PCM samples to WAV blob
   */
  private pcmToWav(pcm: Int16Array): Blob {
    const sampleRate = 16000;
    const numChannels = 1;
    const bytesPerSample = 2;
    const dataLength = pcm.length * bytesPerSample;
    
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
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
    view.setUint32(40, dataLength, true);
    
    // Copy PCM data
    const pcmView = new Int16Array(buffer, 44);
    pcmView.set(pcm);
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Get AI response for transcript
   */
  private async getAiResponse(transcript: string): Promise<string> {
    const { vaultStore } = await import('../stores/VaultStore');
    const { storageService } = await import('./StorageService');
    
    if (!vaultStore.hasOpenAiKey) {
      return `You said: ${transcript}`;
    }

    const apiKey = storageService.getOpenAiKey();
    if (!apiKey) {
      return `You said: ${transcript}`;
    }

    try {
      // Use chat completion
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant on a handheld device. Keep responses brief and conversational.',
            },
            {
              role: 'user',
              content: transcript,
            },
          ],
          max_tokens: 150,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const result = await response.json();
      return result.choices?.[0]?.message?.content || 'I could not generate a response.';
    } catch (err) {
      console.error('[VoiceService] AI error:', err);
      return `You said: ${transcript}`;
    }
  }

  /**
   * Speak response using TTS, routed via AudioRoutingService
   */
  private async speakResponse(text: string): Promise<void> {
    // Import audio routing service
    const { audioRoutingService } = await import('./AudioRoutingService');
    
    // Use the routing service which handles device selection
    await audioRoutingService.speak(text, 'ai');
  }

  // ==========================================================================
  // Event System
  // ==========================================================================

  /**
   * Subscribe to voice events
   */
  onEvent(callback: (event: VoiceEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private emit(event: VoiceEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[VoiceService] Listener error:', err);
      }
    }
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
  async cancel(): Promise<void> {
    // Stop any TTS in progress
    try {
      const Speech = await import('expo-speech');
      await Speech.stop();
    } catch {
      // expo-speech may not be available
    }
    
    runInAction(() => {
      this.state = 'idle';
      this.currentSession = null;
    });
    this.pcmBuffer = [];
    this.opusFrames = [];
    this.emit({ type: 'end' });
  }

  /**
   * Get current status for debugging
   */
  getStatus() {
    return {
      state: this.state,
      hasSession: this.currentSession !== null,
      packetCount: this.currentSession?.packets.length ?? 0,
      lastResult: this.lastResult,
    };
  }
}

export const voiceService = new VoiceService();
