# Tapir Runtime - Roadmap & Future Work

## Current Status (v1.0)

### ✅ Completed

- **Core Runtime**
  - MobX state management (DeviceStore, TerminalStore, LauncherStore, VaultStore, NotificationStore)
  - BLE connection with MTU negotiation and connection priority
  - Write queue with pacing to prevent GATT busy errors
  - 32×18 terminal display support

- **WebView Bridge**
  - Bidirectional communication (JS ↔ Native)
  - LED control, terminal updates, echo
  - AI proxy (OpenAI, Anthropic) with secure key storage
  - Sandboxed per-app storage
  - Button and notification event forwarding

- **App Launcher**
  - 9-slot configurable app grid
  - Physical button mapping (3×4 matrix)
  - Persistent configuration in MMKV

- **Settings & Vault**
  - Encrypted API key storage (MMKV)
  - App slot configuration UI
  - Auto-connect preference

- **Notifications**
  - Android notification listener integration
  - Event forwarding to active mini-app

---

## 🚧 In Progress / Needs Testing

### Notification Listener
- **Status:** Code complete, needs native rebuild
- **Action:** Run `eas build --platform android --profile development` to include native module
- **Test:** Verify notifications appear in Pager app

### BLE Performance Benchmark
- **Status:** Not tested at high FPS
- **Action:** Port the Matrix animation demo and measure actual FPS
- **Target:** 16 FPS sustained (matching Kotlin prototype)

---

## 📋 Planned Features

### Phase 3 Completion: Device-as-Key Authentication

The "hardware key" auth model from the original plan. Requires firmware support.

**Backend Requirements:**
- [ ] Challenge-response endpoint (`POST /auth/challenge`)
- [ ] Signature verification (Ed25519)
- [ ] User account = Device ID (no passwords)

**Firmware Requirements:**
- [ ] Ed25519 private key storage (secure element or OTP)
- [ ] Sign challenge with device key
- [ ] Return signature over BLE

**App Implementation:**
```typescript
// Future: DeviceStore.ts
async authenticateWithCloud(): Promise<string> {
  // 1. Request challenge from backend
  const { challenge } = await api.post('/auth/challenge', { deviceId });
  
  // 2. Send challenge to device, get signature
  const signature = await bleService.signChallenge(challenge);
  
  // 3. Exchange signature for JWT
  const { token } = await api.post('/auth/verify', { deviceId, signature });
  
  return token;
}
```

**Priority:** Medium (blocked by firmware)

---

### Phase 4 Completion: Voice Loop

Enable hands-free interaction with mini-apps.

**Dependencies:**
- [ ] `expo-speech` - Text-to-Speech
- [ ] `@react-native-voice/voice` - Speech-to-Text

**Bridge API:**
```javascript
// TTS
await tapir.tts.speak("Hello world", { language: 'en-US', rate: 1.0 });

// STT
tapir.on('voiceResult', (text) => {
  console.log('User said:', text);
});
await tapir.stt.start({ language: 'en-US' });
await tapir.stt.stop();
```

**Use Cases:**
- Voice-controlled notes app
- Hands-free AI assistant
- Accessibility features

**Priority:** Medium

---

### Cloud Sync & Storage

Sync mini-app data across devices (same device ID).

**API Design:**
```javascript
// Cloud storage (authenticated with device key)
await tapir.cloud.set('notes', JSON.stringify(notes));
const notes = await tapir.cloud.get('notes');

// Sync status
tapir.on('syncStatus', ({ syncing, lastSync }) => { ... });
```

**Backend Requirements:**
- [ ] Key-value store per device ID
- [ ] Conflict resolution (last-write-wins or CRDT)
- [ ] Rate limiting

**Priority:** Low

---

### Mini-App Marketplace / Discovery

A way to discover and install mini-apps.

**Options:**
1. **Curated list** - JSON manifest hosted on GitHub
2. **GitHub Topics** - Search for `tapir-miniapp` tagged repos
3. **Full marketplace** - Backend with ratings, reviews (overkill for now)

**Manifest Format:**
```json
{
  "apps": [
    {
      "id": "pager",
      "name": "Pager",
      "icon": "📟",
      "url": "https://dioco-group.github.io/tapir-miniapps/pager.html",
      "description": "Notifications + world clocks",
      "author": "dioco-group",
      "version": "1.0.0"
    }
  ]
}
```

**Priority:** Low

---

## 🔧 Technical Improvements

### Performance

- [ ] **FPS Counter** - Display actual terminal update rate in debug mode
- [ ] **Buffer Diffing** - Only send changed regions (reduce BLE traffic)
- [ ] **Compression** - RLE or LZ4 for terminal buffer (if bandwidth-limited)

### Developer Experience

- [ ] **Mini-App DevTools** - Console log forwarding from WebView to Metro
- [ ] **Hot Reload for Mini-Apps** - Detect URL changes and reload WebView
- [ ] **Mock Bridge for Browser** - Test mini-apps without the device

### Reliability

- [ ] **Connection Recovery** - Auto-reconnect on BLE disconnect
- [ ] **Offline Queue** - Queue BLE writes when disconnected, flush on reconnect
- [ ] **Crash Reporting** - Sentry or similar for production builds

### Security

- [ ] **Content Security Policy** - Restrict what mini-apps can load
- [ ] **Permission System** - Mini-apps request permissions (notifications, AI, etc.)
- [ ] **Rate Limiting** - Prevent mini-apps from spamming BLE writes

---

## 🐛 Known Issues

| Issue | Severity | Workaround |
|-------|----------|------------|
| MMKV namespace conflict on Android | Medium | EAS builds work; local prebuild may fail |
| WSL2 requires tunnel mode or port forwarding | Low | Use `--tunnel` flag |
| Notification listener needs rebuild | Low | Run EAS build after adding dependency |

---

## 📱 Mini-App Ideas

Ideas for future mini-apps to build:

| App | Description | Complexity |
|-----|-------------|------------|
| **Timer** | Countdown timer with LED progress | Easy |
| **Stopwatch** | Lap times displayed on terminal | Easy |
| **Calculator** | Basic calc with button input | Easy |
| **Snake** | Classic game using 9 buttons | Medium |
| **Pomodoro** | Work timer with break reminders | Medium |
| **Weather** | Current weather via API | Medium |
| **Spotify** | Now playing + controls | Medium |
| **ChatGPT** | AI chat with voice | Hard |
| **Calendar** | Today's events from Google Calendar | Hard |

---

## 📅 Suggested Milestones

### v1.1 - Polish
- [ ] Notification listener working end-to-end
- [ ] FPS benchmark passing (16fps)
- [ ] Connection auto-recovery

### v1.2 - Voice
- [ ] TTS integration
- [ ] STT integration
- [ ] Voice assistant mini-app

### v1.3 - Cloud
- [ ] Device-as-key authentication
- [ ] Cloud sync for mini-app data

### v2.0 - Ecosystem
- [ ] Mini-app marketplace
- [ ] Permission system
- [ ] Multiple device support

---

## Contributing

See the main [README.md](./README.md) for development setup.

For mini-app development, see [tapir-miniapps](https://github.com/dioco-group/tapir-miniapps).

