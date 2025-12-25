# Tapir Runtime

A React Native (Expo) runtime for Tapir devices. Provides a sandboxed environment for Mini-Apps to control the device display, LEDs, and access AI services.

## Features

- **BLE Connection**: Connect to Tapir devices via Bluetooth Low Energy
  - High MTU negotiation for speed
  - Connection priority optimization
  - Write queue with pacing (prevents GATT busy errors)
  
- **Terminal Display**: 40×20 character terminal output
  - Real-time screen updates
  - Matrix animation demo
  
- **LED Control**: 12-key RGB LED grid control

- **Mini-App Sandbox**: WebView-based Mini-Apps with native bridge
  - LED control: `window.tapir.led(index, r, g, b)`
  - Terminal: `window.tapir.terminal(buffer, cols, rows)`
  - AI Chat: `window.tapir.ai.chat(prompt)`
  - Storage: `window.tapir.storage.get/set(key, value)`
  - Event listeners for button presses and notifications

- **API Key Vault**: Secure storage for API keys (OpenAI, Anthropic)
  - Encrypted with MMKV
  - Proxy pattern: Mini-Apps request actions, not keys

## Architecture

```
/src
  /stores       # MobX stores (DeviceStore, TerminalStore, VaultStore)
  /services     # Singleton services (BleService, StorageService)
  /components   # React components (MiniAppView, ConnectionStatus)
  /screens      # Navigation screens
  /bridge       # WebView ↔ Native communication
  /types        # TypeScript types (protocol, bridge)
```

## BLE Protocol

Based on SiFli Serial Transfer Service:

- **Service UUID**: `00000000-0000-0000-6473-5f696c666973`
- **Data Char UUID**: `00000000-0000-0200-6473-5f696c666973`

Message format: `[MSG_TYPE:1B][PAYLOAD...]`

| Type | Code | Direction | Description |
|------|------|-----------|-------------|
| KEYPRESS | 0x10 | Device→App | Button press event |
| LED | 0x20 | App→Device | LED control |
| ECHO | 0x30 | Bidirectional | Echo test |
| FULL_SCREEN | 0x40 | App→Device | Terminal screen update |
| CLEAR_SCREEN | 0x41 | App→Device | Clear terminal |

## Development

### Prerequisites

- Node.js 18+
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)

### Setup

```bash
cd projects/tapir-rn
npm install
```

### Run (Development)

```bash
# Start Expo dev server
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios
```

### Build (Production)

For native builds, you need to prebuild first:

```bash
# Generate native projects
npx expo prebuild

# Build Android APK
cd android && ./gradlew assembleRelease
```

## Mini-App Bridge API

Mini-Apps running in the WebView have access to `window.tapir`:

```javascript
// Device Control
await tapir.led(index, r, g, b);
await tapir.terminal(base64Buffer, cols, rows);
await tapir.terminalClear();
await tapir.echo(data);

// AI (proxied through native - keys never exposed)
const { text } = await tapir.ai.chat(prompt);

// Storage (sandboxed per app)
await tapir.storage.set('key', 'value');
const value = await tapir.storage.get('key');

// Device Info
const info = await tapir.device.info();

// Events
tapir.on('button', (data) => {
  console.log('Button', data.id, data.event);
});

tapir.on('connection', (data) => {
  console.log('Connection:', data.state);
});
```

## Security

- API keys stored encrypted in MMKV
- Mini-Apps sandboxed in WebView
- Proxy pattern: Mini-Apps can't access raw API keys
- Each Mini-App has isolated storage namespace

## License

(C) 2025 Alnicko Lab OU. All rights reserved.

