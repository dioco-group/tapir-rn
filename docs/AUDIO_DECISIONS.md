# Audio Architecture Decisions

This document captures the key decisions made for Tapir's audio system, the reasoning behind them, and alternatives that were considered but not chosen.

---

## Decision 1: Standard Bluetooth Profiles for Playback

### What We Decided
Use standard A2DP and HFP Bluetooth profiles for audio playback (music, TTS, calls).

### Why
- Android handles routing automatically
- Works with all apps (Spotify, YouTube, etc.) without modification
- No custom audio streaming code needed
- Battle-tested, reliable

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| Custom audio over BLE | Bandwidth concerns, latency, complexity |
| Custom audio over BT Classic Serial | Unnecessary - A2DP already does this well |
| Device-side TTS engine | 200MHz ARM is limited; phone TTS is better quality |

### Notes
- Tapir appears to Android as a standard Bluetooth speaker/headset
- Headphone jack on Tapir outputs whatever A2DP receives
- No special integration needed - just pair and go

---

## Decision 2: PTT Voice Capture over BLE (Not SCO)

### What We Decided
Stream microphone audio from Tapir to phone over BLE serial protocol using Opus codec, not via Bluetooth SCO.

### Why
- **A2DP stays active**: Music doesn't pause when using PTT
- **Lower latency**: No SCO setup time (~200-500ms saved)
- **Full control**: We own the protocol, can optimize
- **No HFP dependency**: Works even if HFP not connected

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| SCO (Bluetooth voice channel) | Pauses A2DP, forces music to stop |
| Phone microphone | Defeats purpose of PTT on device |
| Raw PCM over BLE | Too much bandwidth (256 kbps vs 16 kbps) |
| BT Classic Serial for audio | Would work, but BLE is already connected |

### Notes
- Opus at 16kbps gives good voice quality in ~2.4 KB/s
- 20ms frames = 50 packets/second, well within BLE bandwidth
- Requires Opus encoder in firmware (~30-50KB code)
- Phone decodes Opus, sends to STT (Whisper or on-device)

### Trade-off Accepted
- More complexity in firmware (Opus encoding)
- But: Much better UX (music keeps playing)

---

## Decision 3: Audio Routing Priority

### What We Decided
Audio routes to outputs in this priority:

1. **Phone headphone jack** (if phone has one and headphones plugged in)
2. **Tapir headphone jack** (if headphones plugged into Tapir)
3. **Non-Tapir Bluetooth headphones** (AirPods, etc.)
4. **Tapir speaker** (if phone screen OFF)
5. **Phone speaker** (if phone screen ON)

### Why
- Wired always wins (lowest latency, highest quality)
- Tapir jack is a key feature (brings back the headphone jack)
- User's existing BT headphones respected
- Screen state determines speaker: pocket = Tapir, in-hand = phone

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| Always Tapir when connected | Ignores user's preference for their own headphones |
| Always phone speaker | Defeats purpose of Tapir audio |
| Manual toggle only | Bad UX, too much friction |

### Notes
- Phone headphone jack detection: native module needed
- Tapir headphone jack detection: BLE event from device
- Screen state: `AppState` API
- BT headphone detection: native module needed

---

## Decision 4: Independent Speaker and Headphone Outputs

### What We Decided
Tapir's speaker and headphone jack are independent - can play different audio simultaneously.

### Why
- Notifications/alerts on speaker while music plays in headphones
- User doesn't need to remove headphones to hear phone ring
- Better UX than phone (most phones can't do this)

### Use Case Example
```
User has headphones in Tapir, listening to music.
Phone call comes in:
- Music pauses in headphones
- Ringtone plays on SPEAKER
- LRA vibrates
- User hears ring without removing headphones
```

### Notes
- This is a firmware capability, not an app decision
- App just sends different audio to different outputs
- Requires firmware to route A2DP to jack, alerts to speaker

---

## Decision 5: AI PTT Response Always to Tapir Speaker

### What We Decided
When using PTT for AI interaction, the response always plays on Tapir speaker (not headphones, not phone).

### Why
- PTT is explicitly a "Tapir interaction"
- Walkie-talkie mental model: talk into it, it talks back
- Keeps headphone audio (music) separate
- Consistent, predictable behavior

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| Route to current audio output | Confusing - sometimes headphones, sometimes not |
| Always headphones if connected | Mixes AI with music, jarring |
| User setting | Extra complexity, most users want consistent |

### Notes
- Music in headphones is unaffected (just ducked briefly)
- AI response volume independent of music volume
- Could revisit if users request option

---

## Decision 6: Notifications Mirror on Both Devices

### What We Decided
When a notification arrives, alert on both phone AND Tapir:
- Phone: sound + vibration (as normal)
- Tapir: sound on speaker + LRA haptic

### Why
- User might not have phone in pocket
- Redundancy is good for important alerts

### Important: Respect Phone's Sound Profile
Tapir mirrors the phone's ringer mode:
- **Normal mode**: Tapir plays sound + LRA haptic
- **Vibrate mode**: Tapir only uses LRA haptic (no sound)
- **Silent mode**: Tapir is silent (no sound, no haptic)

This ensures consistency - user sets phone to vibrate in a meeting, Tapir doesn't suddenly ring.

### Notes
- Tapir only alerts if connected
- Could add setting to disable one or the other
- Notification content displayed on Tapir screen
- Query phone ringer mode via `AudioManager.getRingerMode()`

---

## Decision 7: Calls via Standard HFP

### What We Decided
Phone calls use standard HFP (Hands-Free Profile), not our custom protocol.

### Why
- Android handles call routing automatically
- Answer/reject buttons just work
- Caller ID, hold, mute all handled
- No custom code needed

### Notes
- Tapir mic + speaker used for calls (bidirectional)
- If user has headphones in Tapir jack, call audio goes there
- Ringtone can go to speaker (independent output)

### Limitation
- VoIP calls (Telegram, WhatsApp) may not route via HFP
- VoIP apps control their own audio
- User may need to answer on phone, audio routes to Tapir if active

---

## Decision 8: No Device-Side Alert Sounds

### What We Decided
Tapir does not store or generate its own alert sounds. All audio comes from the phone via A2DP.

### Why
- Simpler firmware
- Consistent sound with user's phone settings
- No need to update device for new sounds
- Less flash storage used

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| Built-in beeps/sounds | Extra complexity, limited customization |
| Downloadable sound packs | Over-engineering for v1 |

### Notes
- LRA haptic patterns ARE stored on device (simple, no audio)
- Phone generates notification sounds, streams via A2DP
- If phone is disconnected, no sounds (just LRA)

---

## What We Left on the Table

These features were discussed but deferred:

| Feature | Status | Notes |
|---------|--------|-------|
| Device-side TTS | Deferred | 200MHz ARM could do it, but phone is better |
| Custom audio over BT Serial | Deferred | Not needed given A2DP works well |
| Simultaneous A2DP + SCO | Not possible | Hardware limitation on most devices |
| BT LE Audio | Future | Android 13+, new hardware needed |
| Audio EQ on device | Not planned | Phone apps handle this |
| Multi-device audio sync | Not planned | Complex, niche use case |

---

## Summary

| Aspect | Decision |
|--------|----------|
| Music/Media playback | Standard A2DP |
| Phone calls | Standard HFP |
| PTT mic input | Custom BLE + Opus |
| Audio routing | Priority: Phone jack > Tapir jack > BT > Speaker |
| AI responses | Always Tapir speaker |
| Notifications | Mirror on both devices |
| Alert sounds | From phone via A2DP, not device-generated |
| Haptics | Device LRA, controlled via BLE commands |

