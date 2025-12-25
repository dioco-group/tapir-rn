# Tapir Runtime

A React Native (Expo) runtime for Tapir BLE devices. Provides a sandboxed environment for Mini-Apps to control the device display, LEDs, and access AI services.

## Features

- **BLE Connection**: Connect to Tapir devices via Bluetooth Low Energy
  - High MTU negotiation for speed
  - Connection priority optimization
  - Write queue with pacing (prevents GATT busy errors)
  
- **Terminal Display**: 32×18 character terminal output
  - Real-time screen updates at ~4 FPS
  - UTF-8 support (Cyrillic, etc.)
  
- **LED Control**: 12-key RGB LED grid control

- **App Launcher**: 9-slot app launcher with physical button support
  - 3×3 app grid (buttons 0-8)
  - System buttons: Back (9), Home (10), Menu (11)
  - Configurable URLs for each slot

- **Mini-App Sandbox**: WebView-based Mini-Apps with native bridge
  - LED control: `window.tapir.led(index, r, g, b)`
  - Terminal: `window.tapir.terminal(base64Buffer)`
  - AI Chat: `window.tapir.ai.chat(prompt)`
  - Storage: `window.tapir.storage.get/set(key, value)`
  - Event listeners for button presses and notifications

- **Notification Forwarding**: Android notifications forwarded to Mini-Apps
  - Requires notification listener permission
  
- **API Key Vault**: Secure storage for API keys (OpenAI, Anthropic)
  - Encrypted with MMKV
  - Proxy pattern: Mini-Apps request actions, not keys

## Physical Button Layout

```
┌─────┬─────┬─────┐
│  0  │  1  │  2  │  → Apps 1-3
├─────┼─────┼─────┤
│  3  │  4  │  5  │  → Apps 4-6
├─────┼─────┼─────┤
│  6  │  7  │  8  │  → Apps 7-9
├─────┼─────┼─────┤
│  9  │ 10  │ 11  │  → Back / Home / Menu
└─────┴─────┴─────┘
```

## Architecture

```
/src
  /stores       # MobX stores (DeviceStore, TerminalStore, LauncherStore, etc.)
  /services     # Singleton services (BleService, StorageService)
  /components   # React components (MiniAppView, ConnectionStatus)
  /screens      # Navigation screens (Home, Launcher, Settings, etc.)
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
| FULL_SCREEN | 0x40 | App→Device | Terminal screen update (32×18) |
| CLEAR_SCREEN | 0x41 | App→Device | Clear terminal |

## Development

### Prerequisites

- Node.js 18+
- EAS CLI: `npm install -g eas-cli`
- Expo account (for EAS builds)

### Setup

```bash
npm install
eas login
```

### Build Development Client

This app requires a **development client** (not Expo Go) due to native BLE modules:

```bash
# Build for Android (cloud build, ~15 min)
eas build --platform android --profile development

# Install the APK on your device, then start the dev server:
npx expo start --dev-client
```

### WSL2 Users

If developing in WSL2, see [WSL2_SETUP.md](./WSL2_SETUP.md) for network configuration.

Quick setup:
```bash
# Start with tunnel (easiest)
npx expo start --dev-client --tunnel

# Or configure port forwarding for LAN mode
```

### Local Prebuild (Optional)

For local Android builds without EAS:

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
```

## Mini-App Bridge API

Mini-Apps running in the WebView have access to `window.tapir`:

```javascript
// Device Control
await tapir.led(index, r, g, b);
await tapir.terminal(base64Buffer);  // 32×18 = 576 bytes
await tapir.terminalClear();
await tapir.echo(data);

// AI (proxied through native - keys never exposed)
const { text } = await tapir.ai.chat(prompt);

// Storage (sandboxed per app)
await tapir.storage.set('key', 'value');
const value = await tapir.storage.get('key');

// Device Info
const info = await tapir.device.info();
// { connected, deviceId, mtu, terminalCols: 32, terminalRows: 18, fps }

// Check connection
if (tapir.isConnected()) { ... }

// Events
tapir.on('button', ({ id, event }) => {
  console.log('Button', id, event); // event: 'down' | 'up'
});

tapir.on('notification', ({ app, title, text, timestamp }) => {
  console.log('Notification from', app, title);
});

tapir.on('connectionChange', (isConnected) => {
  console.log('Connection:', isConnected);
});

// Launcher control (from within apps)
await tapir.call('launcher.home');  // Go back to launcher
await tapir.call('launcher.back');  // Go back
```

## Creating a Mini-App

Mini-apps are simple HTML files hosted anywhere (local server, GitHub Pages, etc.):

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My App</title>
</head>
<body>
  <script>
    const COLS = 32, ROWS = 18;
    
    function render() {
      let buffer = 'Hello Tapir!'.padEnd(COLS * ROWS);
      window.tapir.terminal(btoa(buffer));
    }
    
    // Update when connected
    if (window.tapir.isConnected()) {
      render();
    }
    
    window.tapir.on('connectionChange', (connected) => {
      if (connected) render();
    });
  </script>
</body>
</html>
```

See [tapir-miniapps](https://github.com/dioco-group/tapir-miniapps) for examples.

## Configuration

### App Slots

Configure the 9 launcher apps in **Settings → App Slots**:
- Name (display name, max 12 chars)
- Icon (emoji)
- URL (http/https)

### API Keys

Add API keys in **Settings → API Keys Vault**:
- OpenAI (for GPT models)
- Anthropic (for Claude models)

Keys are encrypted and never exposed to Mini-Apps.

## Security

- API keys stored encrypted in MMKV
- Mini-Apps sandboxed in WebView
- Proxy pattern: Mini-Apps can't access raw API keys
- Each Mini-App has isolated storage namespace
- Notification content only forwarded to active Mini-App

## License

(C) 2025 Alnicko Lab OU. All rights reserved.
