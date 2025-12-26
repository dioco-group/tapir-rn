# Tapir Bridge API

Clean, minimal API for mini-apps. All methods return Promises.

```
window.tapir
├── device          # Tapir hardware
├── display         # Device screen
├── led             # Button LEDs  
├── phone           # Host phone
├── location        # GPS
├── notifications   # Android notifications
├── ai              # AI chat
├── voice           # TTS + STT
├── storage         # Per-app data
└── launcher        # Navigation
```

---

## Core

```js
tapir.isConnected()              // Is device connected?
tapir.on(event, callback)        // Subscribe to events
tapir.off(event, callback)       // Unsubscribe
```

---

## Device (Tapir Hardware)

```js
// Info
await tapir.device.info()
// → { name: "TAPIR-1234", connected: true, mtu: 247 }

// Battery
await tapir.device.battery()
// → { level: 0.85, charging: false }

// Vibrate
await tapir.device.vibrate()

// Sensors (subscribe to updates)
tapir.device.sensors.on('accelerometer', ({ x, y, z }) => { })
tapir.device.sensors.on('gyroscope', ({ x, y, z }) => { })
tapir.device.sensors.on('compass', ({ heading }) => { })
tapir.device.sensors.off('accelerometer')
```

---

## Display

```js
// Full screen (base64, 32×18 = 576 ASCII chars)
await tapir.display.write(btoa(buffer))

// Clear
await tapir.display.clear()
```

---

## LED

```js
// Set single LED
await tapir.led.set(0, { r: 255, g: 0, b: 0 })

// Set all LEDs
await tapir.led.setAll([
  { r: 255, g: 0, b: 0 },  // Button 0
  { r: 0, g: 255, b: 0 },  // Button 1
  // ... 12 total
])

// Turn off
await tapir.led.off(0)     // Single
await tapir.led.off()      // All
```

---

## Phone

```js
// Battery
await tapir.phone.battery()
// → { level: 0.72, charging: true, lowPower: false }

// Network
await tapir.phone.network()
// → { type: "wifi", connected: true }
// type: "wifi" | "cellular" | "none"

// Vibrate
await tapir.phone.vibrate()
await tapir.phone.vibrate('success')  // success | warning | error

// Steps (pedometer)
await tapir.phone.steps()             // Today's count
await tapir.phone.steps(startDate, endDate)

// Biometric auth
const { success } = await tapir.phone.authenticate("Confirm action")

// Open URLs
await tapir.phone.open("https://example.com")
await tapir.phone.open("tel:+1234567890")
await tapir.phone.open("geo:37.7749,-122.4194")

// Compose (opens app, user sends)
await tapir.phone.email({ to: "a@b.com", subject: "Hi", body: "..." })
await tapir.phone.sms({ to: "+1234567890", body: "Hello" })

// Share
await tapir.phone.share({ text: "Check this out!", url: "..." })

// Settings
await tapir.phone.settings("wifi")      // wifi | bluetooth | location | notifications
```

---

## Location

```js
// Request permission (call once)
await tapir.location.requestPermission()

// Get current position
await tapir.location.get()
// → { lat: 35.6762, lon: 139.6503, accuracy: 10, timestamp: 1703612400000 }

// Watch position
tapir.location.watch(({ lat, lon }) => { })
tapir.location.stopWatch()
```

---

## Notifications

```js
// Listen to incoming (already granted via system settings)
tapir.on('notification', ({ app, title, text, time }) => { })

// Get recent
await tapir.notifications.list()
// → [{ app, title, text, time }, ...]

// Post new (requires permission)
await tapir.notifications.post({ title: "Timer", body: "Done!" })
```

---

## AI

```js
// Chat (uses keys stored in native app - never exposed)
const { text } = await tapir.ai.chat("What's the weather?")
const { text } = await tapir.ai.chat("Summarize this", { 
  model: "gpt-4o",
  maxTokens: 500 
})
```

---

## Voice

```js
// Text to speech
await tapir.voice.speak("Hello world")
await tapir.voice.speak("Bonjour", { lang: "fr" })

// Speech recognition (triggered by device PTT button)
tapir.on('voice', ({ text, final }) => {
  if (final) console.log("You said:", text)
})
```

---

## Storage

Per-app sandboxed storage. Each mini-app has isolated data.

```js
await tapir.storage.set("key", { any: "value" })
const value = await tapir.storage.get("key")
await tapir.storage.remove("key")
const keys = await tapir.storage.keys()
await tapir.storage.clear()
```

---

## Launcher

```js
tapir.launcher.home()        // Go to launcher
tapir.launcher.back()        // Go back
await tapir.launcher.apps()  // Get app list
// → [{ id, name, icon, url }, ...]
```

---

## Events

```js
tapir.on('button', ({ id, state }) => { })
// state: "down" | "up"
// id: 0-11 (grid), 12-13 (triggers)

tapir.on('notification', ({ app, title, text, time }) => { })

tapir.on('connection', ({ connected }) => { })

tapir.on('voice', ({ text, final }) => { })
```

---

## Permissions

| API | Permission |
|-----|------------|
| device, display, led, storage, launcher | Always allowed |
| phone (battery, network, vibrate) | Always allowed |
| phone (open, email, sms, share) | Always allowed (opens native app) |
| phone.steps | Always allowed |
| phone.authenticate | Biometric prompt |
| notifications.list | Granted at install |
| notifications.post | Prompt once |
| location | Prompt once |
| voice (PTT) | Hardware triggered |
| contacts, calendar | Prompt once |
| sms.send (auto) | High risk - maybe never |

---

## Implementation Status

| API | Status |
|-----|--------|
| device.info | ✅ |
| device.vibrate | ✅ |
| device.battery | 🔜 firmware |
| device.sensors | 🔜 firmware |
| display.write | ✅ |
| display.clear | ✅ |
| led.set | ✅ |
| led.setAll | 🔜 |
| led.off | 🔜 |
| phone.battery | 🔜 |
| phone.network | 🔜 |
| phone.vibrate | ✅ |
| phone.steps | 🔜 |
| phone.authenticate | 🔜 |
| phone.open | 🔜 |
| phone.email | 🔜 |
| phone.sms | 🔜 |
| phone.share | 🔜 |
| phone.settings | 🔜 |
| location.* | 🔜 |
| notifications.list | 🔜 |
| notifications.post | 🔜 |
| ai.chat | ✅ |
| voice.speak | ✅ |
| voice (PTT) | 🔜 |
| storage.* | ✅ |
| launcher.* | ✅ |
