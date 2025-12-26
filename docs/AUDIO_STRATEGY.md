# Tapir Audio Strategy

How Tapir integrates with the Android audio ecosystem.

---

## Device Capabilities

| Component | Function |
|-----------|----------|
| **Speaker** | Alerts, ringtones, TTS when no headphones |
| **3.5mm Jack** | High-quality audio output, headphone detection |
| **Microphone** | Voice input for calls, STT |
| **LRA** | Haptic feedback |
| **BT Classic** | A2DP (audio sink), HFP (calls), Serial (raw audio) |
| **BLE** | Commands, text, low-bandwidth data |

Key feature: **Speaker and headphone jack are independent** - can play different audio simultaneously.

---

## Bluetooth Profiles

### How Tapir Appears to Android

```
┌─────────────────────────────────────────────────────────────┐
│                     ANDROID SYSTEM                          │
│                                                             │
│   Tapir appears as:                                         │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │   A2DP      │  │    HFP      │  │  BLE Serial │        │
│   │   Sink      │  │  Headset    │  │   (custom)  │        │
│   │  (music)    │  │  (calls)    │  │  (control)  │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

| Profile | Purpose | Audio Direction |
|---------|---------|-----------------|
| **A2DP** | Media audio (music, podcasts, TTS) | Phone → Tapir |
| **HFP** | Phone calls | Bidirectional |
| **BT Serial** | Raw audio streaming (custom) | Bidirectional |
| **BLE** | Commands, not audio | N/A |

---

## Audio Routing Strategy

### Android Audio Streams

Android has distinct audio streams. Here's how they route to Tapir:

| Android Stream | Default Behavior | Tapir Routing |
|----------------|------------------|---------------|
| `STREAM_MUSIC` | Media playback | → Headphones (if plugged) |
| `STREAM_VOICE_CALL` | Phone calls | → Headphones or Speaker (HFP) |
| `STREAM_RING` | Incoming call ring | → Speaker (always audible) |
| `STREAM_NOTIFICATION` | App notifications | → Speaker + LRA |
| `STREAM_ALARM` | Alarms, timers | → Speaker + LRA |
| `STREAM_SYSTEM` | UI sounds | → Speaker (optional) |

### Tapir Output Selection

```
┌─────────────────────────────────────────────────────────────┐
│                    ROUTING DECISION                         │
│                                                             │
│   Is audio urgent/alert?                                    │
│       YES → Speaker + LRA (always audible)                  │
│       NO  → Continue...                                     │
│                                                             │
│   Are headphones plugged in?                                │
│       YES → Headphones (high quality)                       │
│       NO  → Continue...                                     │
│                                                             │
│   Is phone screen on?                                       │
│       YES → Phone speaker (user is looking)                 │
│       NO  → Tapir speaker (phone in pocket)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Output Matrix

| Content | Headphones In | Headphones Out, Screen Off | Headphones Out, Screen On |
|---------|---------------|---------------------------|---------------------------|
| Music | Headphones | Tapir speaker | Phone speaker |
| Podcasts | Headphones | Tapir speaker | Phone speaker |
| AI TTS | Headphones | Tapir speaker | Phone speaker |
| Navigation | Headphones (duck music) | Tapir speaker | Phone speaker |
| Ringtone | **Speaker** (hear over music) | Tapir speaker | Phone speaker |
| Notifications | **Speaker** + LRA | Tapir speaker + LRA | Phone + LRA |
| Alarms | **Speaker** + LRA | Tapir speaker + LRA | Phone + LRA |
| Call audio | Headphones | Tapir speaker + mic | Phone |

---

## Use Case Flows

### 1. Music Playback

```
Spotify on Phone
       │
       ▼
   A2DP Stream
       │
       ▼
┌─────────────────────┐
│       TAPIR         │
│                     │
│  Headphones in?     │
│  YES → 3.5mm jack   │
│  NO  → Speaker      │
└─────────────────────┘
```

### 2. Incoming Call (While Listening to Music)

```
Timeline ─────────────────────────────────────────────────────▶

                     │ INCOMING CALL │
                     │               │
Headphones:  ♪♪♪♪♪♪♪ │ ⏸ PAUSE      │ 📞 Call Audio │ ♪♪♪ Resume
Speaker:     (quiet) │ 🔔 RING!     │ (quiet)       │ (quiet)
LRA:         (still) │ 📳 BUZZ!     │ (still)       │ (still)
Display:     (app)   │ "Call: Mom"  │ "00:45"       │ (app)

User action:         Press PTT to answer
                     or press button to decline
```

### 3. AI Voice Query

```
User presses PTT
       │
       ▼
Tapir Mic → BT Serial → Phone
                          │
                          ▼
                    STT Engine
                          │
                          ▼
                    AI (GPT/Claude)
                          │
                          ▼
                    TTS Engine
                          │
                          ▼
                    A2DP Stream
                          │
                          ▼
┌─────────────────────────────────────────────┐
│                   TAPIR                     │
│  Headphones in? → Headphones                │
│  No headphones? → Speaker                   │
└─────────────────────────────────────────────┘
```

### 4. Notification While Listening

```
                    │ NOTIFICATION │
                    │              │
Headphones: ♪♪♪♪♪♪♪ │ ♪♪♪♪♪♪♪♪♪♪♪ │ ♪♪♪♪♪♪♪
            (uninterrupted)
Speaker:    (quiet) │ *ding*       │ (quiet)
LRA:        (still) │ *buzz*       │ (still)
Display:    (app)   │ "Msg: John"  │ (app)

Music never stops - alert plays on speaker over it.
```

### 5. Navigation While Listening

```
                    │ NAV PROMPT │
                    │            │
Headphones: ♪♪♪♪♪♪♪ │ ♪(duck)♪   │ ♪♪♪♪♪♪♪
                    │ "Turn left"│
                    │ (mixed in) │

Navigation audio ducks (lowers) music, plays over it.
No speaker needed - goes to headphones.
```

---

## Tapir Runtime Audio APIs

### Bridge API for Mini-Apps

```js
// Text-to-Speech (auto-routes)
await tapir.voice.speak("Hello world")
// → Headphones if connected
// → Speaker if no headphones

// Force output
await tapir.voice.speak("Alert!", { output: "speaker" })
await tapir.voice.speak("Private", { output: "headphones" })

// Alerts (always speaker + haptic, even with headphones)
await tapir.alert({
  sound: "notification",  // Speaker
  haptic: "tap",          // LRA
  message: "New message"  // Display
})

// Haptics only
await tapir.device.haptics.buzz("notification")
await tapir.device.haptics.buzz([100, 50, 100, 50, 100])  // Pattern
```

### Audio Status

```js
const status = await tapir.device.audio.status()
// {
//   headphones: true,       // 3.5mm connected
//   speaker: "idle",        // "idle" | "playing"
//   headphoneAudio: "music", // "idle" | "music" | "call" | "tts"
//   volume: 0.7
// }

// Events
tapir.on('audio.headphones', ({ connected }) => {
  // Headphones plugged/unplugged
})
```

### Volume Control

```js
// Device volume (affects speaker + headphones)
await tapir.device.audio.setVolume(0.8)
await tapir.device.audio.getVolume()  // 0.0 - 1.0

// Mute speaker (headphones unaffected)
await tapir.device.audio.muteSpeaker(true)
```

---

## Android Integration

### Tapir Runtime App Responsibilities

1. **Register as A2DP sink** - Receive media audio
2. **Register as HFP headset** - Handle calls
3. **Monitor phone state** - Screen on/off
4. **Route notifications** - Intercept and forward to device
5. **Handle TTS** - Generate audio, send to device

### Audio Focus

The Tapir Runtime app should handle Android Audio Focus:

```kotlin
// When Tapir speaks TTS
audioManager.requestAudioFocus(...)  // Duck other audio

// When done
audioManager.abandonAudioFocus(...)  // Restore other audio
```

### Notification Listener

Already implemented - forwards notifications to device for display + alert.

---

## Hardware Considerations

### Headphone Detection

Device GPIO detects 3.5mm plug insertion:
- Send event to phone via BLE
- Phone updates routing logic
- Device switches audio path

### LRA Patterns

| Pattern Name | Description | Use Case |
|--------------|-------------|----------|
| `tap` | Single short pulse | UI feedback |
| `double-tap` | Two pulses | Confirmation |
| `notification` | Medium pulse | New notification |
| `call` | Repeated pattern | Incoming call |
| `alarm` | Strong repeated | Alarm/timer |
| `success` | Rising pattern | Action completed |
| `error` | Harsh buzz | Error occurred |

### Speaker vs Headphone Volume

Independent volume levels:
- Speaker: Louder for alerts
- Headphones: User-controlled for comfort

---

## Summary

| Audio Type | Primary Output | Fallback | Notes |
|------------|----------------|----------|-------|
| Media (music, podcasts) | Headphones | Tapir speaker | Via A2DP |
| Calls | Headphones | Tapir speaker | Via HFP, bidirectional |
| AI TTS | Headphones | Tapir speaker | Via A2DP |
| Ringtone | **Tapir speaker** | - | Always audible over music |
| Notifications | **Tapir speaker + LRA** | - | Always audible |
| Alarms | **Tapir speaker + LRA** | - | Always audible |
| Navigation | Headphones (duck) | Tapir speaker | Mixes with music |

**Key principle:** Urgent audio (rings, alerts) goes to speaker so it's heard even with headphones in. Regular audio goes to best available output.

