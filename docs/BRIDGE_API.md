# Tapir Bridge API

All APIs are accessed via the `window.tapir` object in mini-apps.

## API Structure

```
window.tapir
├── device          # Tapir hardware
│   ├── info()
│   ├── battery()
│   ├── vibrate()
│   └── sensors
├── display         # Device screen
│   ├── terminal()
│   ├── clear()
│   └── write()
├── led             # Button LEDs
│   ├── set()
│   ├── setAll()
│   └── off()
├── phone           # Host phone
│   ├── battery()
│   ├── network()
│   ├── time()
│   └── vibrate()
├── notifications   # Android notifications
│   ├── list()
│   ├── post()
│   └── on()
├── location        # GPS (prompt once)
│   └── current()
├── media           # Music control
│   ├── playPause()
│   ├── next()
│   ├── previous()
│   └── nowPlaying()
├── ai              # AI chat (proxied)
│   └── chat()
├── voice           # Push-to-talk
│   ├── speak()
│   └── on()
├── storage         # Per-app sandbox
│   ├── get()
│   ├── set()
│   ├── remove()
│   └── keys()
└── launcher        # App navigation
    ├── home()
    ├── back()
    └── getApps()
```

---

## Core

### `tapir.isConnected()`
Check if Tapir device is connected via BLE.

```js
if (tapir.isConnected()) {
  // Device is connected
}
```

### `tapir.on(event, callback)`
Subscribe to events from native layer.

```js
tapir.on('button', ({ id, event }) => {
  console.log(`Button ${id} ${event}`); // "Button 0 down"
});
```

### `tapir.off(event, callback)`
Unsubscribe from events.

---

## Device (Tapir Hardware)

### `tapir.device.info()` → `Promise<DeviceInfo>`
Get device information.

```js
const info = await tapir.device.info();
// { connected: true, mtu: 247, name: "TAPIR-1234" }
```

### `tapir.device.battery()` → `Promise<BatteryInfo>` 🔜
Get device battery status.

```js
const battery = await tapir.device.battery();
// { level: 0.85, charging: false }
```

### `tapir.device.vibrate(pattern?)` → `Promise<void>`
Trigger device haptic feedback.

```js
await tapir.device.vibrate();        // Single pulse
await tapir.device.vibrate([100, 50, 100]); // Pattern
```

### `tapir.device.sensors` 🔜
Device sensor access (accelerometer, gyroscope, compass).

```js
// One-time read
const acc = await tapir.device.sensors.accelerometer();
// { x: 0.1, y: -0.2, z: 9.8 }

// Subscribe to updates
tapir.device.sensors.subscribe('accelerometer', (data) => {
  console.log(data.x, data.y, data.z);
});
```

---

## Display

### `tapir.display.terminal(buffer)` → `Promise<void>`
Write full screen buffer (base64 encoded, 32×18 = 576 chars).

```js
const buffer = "Hello World!".padEnd(576, ' ');
await tapir.display.terminal(btoa(buffer));
```

### `tapir.display.clear()` → `Promise<void>`
Clear the display.

```js
await tapir.display.clear();
```

### `tapir.display.write(x, y, text)` → `Promise<void>` 🔜
Write text at position.

```js
await tapir.display.write(0, 0, "Line 1");
await tapir.display.write(0, 1, "Line 2");
```

---

## LED

### `tapir.led.set(index, r, g, b)` → `Promise<void>`
Set a single button LED color.

```js
await tapir.led.set(0, 255, 0, 0);  // Button 0 = red
```

### `tapir.led.setAll(colors)` → `Promise<void>` 🔜
Set all LEDs at once.

```js
await tapir.led.setAll([
  { r: 255, g: 0, b: 0 },   // Button 0
  { r: 0, g: 255, b: 0 },   // Button 1
  // ...
]);
```

### `tapir.led.off(index?)` → `Promise<void>` 🔜
Turn off LED(s).

```js
await tapir.led.off(0);    // Turn off button 0
await tapir.led.off();     // Turn off all
```

---

## Phone (Host Device)

### `tapir.phone.battery()` → `Promise<BatteryInfo>` 🔜
Get phone battery status.

```js
const battery = await tapir.phone.battery();
// { level: 0.72, charging: true }
```

### `tapir.phone.network()` → `Promise<NetworkInfo>` 🔜
Get network status.

```js
const net = await tapir.phone.network();
// { type: "wifi", connected: true }
// type: "wifi" | "cellular" | "none"
```

### `tapir.phone.time()` → `Promise<TimeInfo>` 🔜
Get current time and timezone.

```js
const time = await tapir.phone.time();
// { now: 1703612400000, timezone: "America/New_York", offset: -300 }
```

### `tapir.phone.vibrate(pattern?)` → `Promise<void>`
Vibrate the phone.

```js
await tapir.phone.vibrate();
```

---

## Notifications

### `tapir.notifications.list()` → `Promise<Notification[]>` 🔜
Get recent notifications.

```js
const notifications = await tapir.notifications.list();
// [{ app: "Messages", title: "John", text: "Hey!", timestamp: 1703612400000 }]
```

### `tapir.notifications.post(title, body, options?)` → `Promise<void>` 🔜
Post a notification. **Requires permission.**

```js
await tapir.notifications.post("Timer", "Your timer is done!");
```

### `tapir.notifications.on(callback)`
Subscribe to new notifications.

```js
tapir.on('notification', (n) => {
  console.log(`${n.app}: ${n.title}`);
});
```

---

## Location

### `tapir.location.current()` → `Promise<Location>` 🔜
Get current GPS location. **Requires permission (prompt once).**

```js
const loc = await tapir.location.current();
// { latitude: 35.6762, longitude: 139.6503, accuracy: 10 }
```

---

## Media

### `tapir.media.playPause()` → `Promise<void>` 🔜
Toggle music playback.

### `tapir.media.next()` → `Promise<void>` 🔜
Skip to next track.

### `tapir.media.previous()` → `Promise<void>` 🔜
Go to previous track.

### `tapir.media.nowPlaying()` → `Promise<NowPlaying>` 🔜
Get currently playing track info.

```js
const track = await tapir.media.nowPlaying();
// { title: "Song Name", artist: "Artist", album: "Album", playing: true }
```

---

## AI

### `tapir.ai.chat(prompt, options?)` → `Promise<{ text: string }>`
Send a chat message to AI. Uses API keys stored in the native app (never exposed to mini-apps).

```js
const response = await tapir.ai.chat("What's the weather like?");
console.log(response.text);
```

Options:
- `model`: Model name (default: gpt-4o-mini)
- `maxTokens`: Max response tokens

---

## Voice

### `tapir.voice.speak(text, options?)` → `Promise<void>`
Text-to-speech.

```js
await tapir.voice.speak("Hello, world!");
```

Options:
- `language`: Language code (e.g., "en-US")
- `pitch`: 0.5 - 2.0
- `rate`: 0.5 - 2.0

### `tapir.voice.on('result', callback)` 🔜
Receive speech recognition results (triggered by device PTT button).

```js
tapir.on('voice', ({ text, final }) => {
  if (final) {
    console.log("You said:", text);
  }
});
```

---

## Storage

Per-app sandboxed storage. Each mini-app has its own namespace.

### `tapir.storage.get(key)` → `Promise<any>`
```js
const value = await tapir.storage.get('highscore');
```

### `tapir.storage.set(key, value)` → `Promise<void>`
```js
await tapir.storage.set('highscore', 1000);
```

### `tapir.storage.remove(key)` → `Promise<void>` 🔜
```js
await tapir.storage.remove('highscore');
```

### `tapir.storage.keys()` → `Promise<string[]>` 🔜
```js
const keys = await tapir.storage.keys();
```

---

## Launcher

### `tapir.launcher.home()` → `Promise<void>`
Go back to launcher.

### `tapir.launcher.back()` → `Promise<void>`
Go back (same as home currently).

### `tapir.launcher.getApps()` → `Promise<{ apps: App[] }>`
Get configured apps.

```js
const { apps } = await tapir.launcher.getApps();
// [{ id: "pager", name: "Pager", icon: "📟", url: "..." }]
```

---

## Events

Events are emitted by the native layer and can be subscribed to with `tapir.on()`.

| Event | Data | Description |
|-------|------|-------------|
| `button` | `{ id, event }` | Button press/release. `event`: "down" \| "up" |
| `notification` | `{ app, title, text, timestamp }` | New notification received |
| `connection` | `{ connected, deviceId }` | Device connection changed |
| `sensor` | `{ type, x, y, z }` | Sensor data from device 🔜 |
| `voice` | `{ text, final }` | Speech recognition result 🔜 |

---

## Implementation Status

| API | Status |
|-----|--------|
| `device.info` | ✅ Implemented |
| `device.vibrate` | ✅ Implemented |
| `device.battery` | 🔜 Planned |
| `device.sensors` | 🔜 Planned (needs firmware) |
| `display.terminal` | ✅ Implemented |
| `display.clear` | ✅ Implemented |
| `display.write` | 🔜 Planned |
| `led.set` | ✅ Implemented |
| `led.setAll` | 🔜 Planned |
| `led.off` | 🔜 Planned |
| `phone.battery` | 🔜 Planned |
| `phone.network` | 🔜 Planned |
| `phone.time` | 🔜 Planned |
| `phone.vibrate` | ✅ Implemented |
| `notifications.on` | ✅ Implemented |
| `notifications.list` | 🔜 Planned |
| `notifications.post` | 🔜 Planned |
| `location.current` | 🔜 Planned |
| `media.*` | 🔜 Planned |
| `ai.chat` | ✅ Implemented |
| `voice.speak` | ✅ Implemented |
| `voice.on` | 🔜 Planned |
| `storage.get/set` | ✅ Implemented |
| `storage.remove/keys` | 🔜 Planned |
| `launcher.*` | ✅ Implemented |

---

## Permissions

| Category | Permission Model |
|----------|-----------------|
| Device, Display, LED, Storage, Launcher | Always allowed |
| Phone (battery, network, time) | Always allowed |
| Media controls | Always allowed |
| Notifications (read) | Granted at app install |
| Notifications (post) | Prompt once |
| Location | Prompt once |
| Voice (PTT) | Hardware-triggered, no prompt |
| Contacts, Calendar | Prompt once |
| SMS | High risk, prompt each time |

