# Firmware Task: PTT Voice over BLE

## Overview

Add Push-to-Talk (PTT) voice capture and streaming over BLE. When KEY2 is pressed, the device records audio from the microphone, encodes it with Opus, and streams packets to the phone over BLE.

## Trigger

- **KEY2 press** → Start recording and streaming
- **KEY2 release** → Stop recording, send end marker

## Hardware

- **Microphone**: Built-in mic
- **Codec**: Opus (software)
- **Transport**: BLE serial protocol (existing)
- **MCU**: 200MHz ARM (should handle Opus encoding easily)

## Audio Parameters

| Parameter | Value |
|-----------|-------|
| Sample rate | 16000 Hz |
| Channels | 1 (mono) |
| Bit depth | 16-bit |
| Opus bitrate | 16 kbps |
| Frame duration | 20ms |
| Samples per frame | 320 samples |
| Opus frame size | ~40-80 bytes |

## BLE Protocol

Uses existing BLE serial protocol. New message types:

### Message Types

| Type | Value | Direction | Description |
|------|-------|-----------|-------------|
| `VOICE_START` | `0x60` | Device → Phone | PTT pressed, stream starting |
| `VOICE_DATA` | `0x61` | Device → Phone | Audio data packet |
| `VOICE_END` | `0x62` | Device → Phone | PTT released, stream ended |

### VOICE_START (0x60)

Sent when KEY2 is pressed. No payload.

```
[Category 0x1F] [Flag] [Type 0x60]
```

### VOICE_DATA (0x61)

Sent continuously while KEY2 is held. Contains one Opus frame.

```
[Category 0x1F] [Flag] [Type 0x61] [Seq Hi] [Seq Lo] [Opus Data...]

Seq: 16-bit sequence number (0-65535, wraps)
Opus Data: Variable length Opus encoded frame (~40-80 bytes)
```

Total packet size: 3 + 2 + ~60 = ~65 bytes (well under MTU)

### VOICE_END (0x62)

Sent when KEY2 is released. No payload.

```
[Category 0x1F] [Flag] [Type 0x62]
```

## Firmware Implementation

### Dependencies

- **libopus**: Opus codec library
  - Or: **opus-embedded** / **celt** for smaller footprint
  - Typical code size: ~30-50KB

### Pseudocode

```c
#include <opus.h>

static OpusEncoder *encoder = NULL;
static uint16_t sequence = 0;
static bool recording = false;

// Buffer for mic samples (20ms @ 16kHz = 320 samples)
static int16_t mic_buffer[320];
static int mic_buffer_pos = 0;

// Initialize encoder (call once at startup)
void voice_init(void) {
    int error;
    encoder = opus_encoder_create(16000, 1, OPUS_APPLICATION_VOIP, &error);
    opus_encoder_ctl(encoder, OPUS_SET_BITRATE(16000));
    opus_encoder_ctl(encoder, OPUS_SET_COMPLEXITY(5));  // Balance quality/CPU
}

// Called when KEY2 pressed
void voice_start(void) {
    if (recording) return;
    
    recording = true;
    sequence = 0;
    mic_buffer_pos = 0;
    
    // Send VOICE_START
    uint8_t msg[] = { 0x60 };
    ble_serial_send(msg, 1);
    
    // Start microphone capture
    mic_start_capture(16000);  // 16kHz sample rate
}

// Called when KEY2 released
void voice_stop(void) {
    if (!recording) return;
    
    recording = false;
    
    // Stop microphone
    mic_stop_capture();
    
    // Send any remaining samples (if partial frame)
    if (mic_buffer_pos > 0) {
        // Pad with silence
        memset(&mic_buffer[mic_buffer_pos], 0, 
               (320 - mic_buffer_pos) * sizeof(int16_t));
        encode_and_send_frame();
    }
    
    // Send VOICE_END
    uint8_t msg[] = { 0x62 };
    ble_serial_send(msg, 1);
}

// Called by mic driver with new samples
void voice_on_samples(int16_t *samples, int count) {
    if (!recording) return;
    
    for (int i = 0; i < count; i++) {
        mic_buffer[mic_buffer_pos++] = samples[i];
        
        // Full frame (320 samples = 20ms)
        if (mic_buffer_pos >= 320) {
            encode_and_send_frame();
            mic_buffer_pos = 0;
        }
    }
}

// Encode and send one frame
static void encode_and_send_frame(void) {
    uint8_t opus_data[80];  // Max Opus frame size for 16kbps
    
    int opus_len = opus_encode(encoder, mic_buffer, 320, opus_data, 80);
    if (opus_len < 0) {
        // Encoding error
        return;
    }
    
    // Build packet: [0x61] [seq_hi] [seq_lo] [opus_data...]
    uint8_t packet[3 + 80];
    packet[0] = 0x61;                    // VOICE_DATA
    packet[1] = (sequence >> 8) & 0xFF;  // Seq high byte
    packet[2] = sequence & 0xFF;         // Seq low byte
    memcpy(&packet[3], opus_data, opus_len);
    
    ble_serial_send(packet, 3 + opus_len);
    
    sequence++;
}

// KEY2 interrupt handler
void key2_handler(bool pressed) {
    if (pressed) {
        voice_start();
    } else {
        voice_stop();
    }
}
```

### Timing

| Event | Interval |
|-------|----------|
| Mic sample callback | Every 1-5ms (depends on driver) |
| Opus frame encode | Every 20ms (when 320 samples collected) |
| BLE packet send | Every 20ms (~50 packets/second) |

At 16kbps Opus + 3 byte header = ~2.4 KB/s over BLE. Well within BLE bandwidth.

### CPU Estimate

Opus encoding at 16kbps, complexity 5:
- ~10-20 MIPS on ARM Cortex-M4
- 200MHz ARM should use <10% CPU

## Testing

1. **Unit test encoding**: Feed known audio, verify Opus output
2. **BLE test**: Send test packets, verify phone receives correct sequence
3. **Integration test**: Press KEY2, speak, verify phone decodes audio
4. **Stress test**: Hold KEY2 for 60 seconds, verify no buffer overflows

## Phone Side (Reference)

Phone will:
1. Receive `VOICE_START` → prepare decoder
2. Receive `VOICE_DATA` packets → decode Opus → accumulate PCM
3. Receive `VOICE_END` → send audio to STT → AI → TTS

## Files to Modify

| File | Changes |
|------|---------|
| `src/voice/` | New directory for voice handling |
| `src/voice/voice.c` | Main voice logic |
| `src/voice/opus_wrapper.c` | Opus encoder wrapper |
| `src/ble/ble_serial.c` | Add VOICE message handlers |
| `src/key/key_handler.c` | Route KEY2 to voice_start/stop |
| `CMakeLists.txt` | Add opus library |

## Definition of Done

- [ ] Opus encoder integrated and compiling
- [ ] KEY2 press starts mic capture
- [ ] Audio encoded to Opus in 20ms frames
- [ ] Packets sent over BLE with sequence numbers
- [ ] KEY2 release stops capture and sends VOICE_END
- [ ] No audio glitches or buffer overflows
- [ ] CPU usage <20% during recording
- [ ] Phone can receive and decode audio (separate task)

