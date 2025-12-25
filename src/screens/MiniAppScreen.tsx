/**
 * MiniAppScreen - WebView sandbox for Mini-Apps
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import { MiniAppView, MiniAppViewRef } from '../components';
import { deviceStore } from '../stores';
import { KeyEvent } from '../types/protocol';

// ============================================================================
// Demo HTML
// ============================================================================

const DEMO_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #11111b;
      color: #cdd6f4;
      padding: 20px;
      min-height: 100vh;
    }
    h1 { 
      font-size: 24px; 
      margin-bottom: 16px;
      color: #cba6f7;
    }
    .status {
      background: #1e1e2e;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid #313244;
    }
    .status-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .status-label { color: #6c7086; }
    .status-value { color: #a6e3a1; font-family: monospace; }
    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      margin-bottom: 8px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:active { opacity: 0.8; }
    .btn-primary { background: #89b4fa; color: #11111b; }
    .btn-success { background: #a6e3a1; color: #11111b; }
    .btn-warning { background: #f9e2af; color: #11111b; }
    .btn-danger { background: #f38ba8; color: #11111b; }
    .log {
      background: #000;
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 12px;
      color: #a6e3a1;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 16px;
    }
    .log-entry { margin-bottom: 4px; }
  </style>
</head>
<body>
  <h1>🦛 Mini-App Demo</h1>
  
  <div class="status" id="status">
    <div class="status-item">
      <span class="status-label">Connection:</span>
      <span class="status-value" id="conn-status">Checking...</span>
    </div>
    <div class="status-item">
      <span class="status-label">Device:</span>
      <span class="status-value" id="device-name">—</span>
    </div>
    <div class="status-item">
      <span class="status-label">MTU:</span>
      <span class="status-value" id="mtu">—</span>
    </div>
  </div>
  
  <button class="btn btn-primary" onclick="testEcho()">📡 Echo Test</button>
  <button class="btn btn-success" onclick="testLed()">💡 Random LED</button>
  <button class="btn btn-warning" onclick="testTerminal()">📺 Terminal Demo</button>
  <button class="btn btn-danger" onclick="clearTerminal()">🧹 Clear Terminal</button>
  
  <div class="log" id="log">
    <div class="log-entry">Ready. Tap a button to test.</div>
  </div>

  <script>
    function log(msg) {
      const el = document.getElementById('log');
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.textContent = '> ' + msg;
      el.appendChild(entry);
      el.scrollTop = el.scrollHeight;
    }
    
    async function updateStatus() {
      try {
        const info = await window.tapir.device.info();
        document.getElementById('conn-status').textContent = info.connected ? 'Connected' : 'Disconnected';
        document.getElementById('device-name').textContent = info.deviceName || '—';
        document.getElementById('mtu').textContent = info.mtu || '—';
      } catch (e) {
        log('Status error: ' + e.message);
      }
    }
    
    async function testEcho() {
      try {
        log('Sending echo...');
        await window.tapir.echo('Hello from Mini-App!');
        log('Echo sent!');
      } catch (e) {
        log('Echo error: ' + e.message);
      }
    }
    
    async function testLed() {
      try {
        const index = Math.floor(Math.random() * 12);
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        log('LED ' + index + ' -> rgb(' + r + ',' + g + ',' + b + ')');
        await window.tapir.led(index, r, g, b);
        log('LED set!');
      } catch (e) {
        log('LED error: ' + e.message);
      }
    }
    
    async function testTerminal() {
      try {
        log('Sending terminal update...');
        const cols = 32;
        const rows = 18;
        let screen = '';
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (y === 0 || y === rows-1 || x === 0 || x === cols-1) {
              screen += '#';
            } else if (y === Math.floor(rows/2) && x > 8 && x < 24) {
              const msg = 'MINI-APP DEMO';
              const idx = x - 9;
              screen += idx < msg.length ? msg[idx] : ' ';
            } else {
              screen += ' ';
            }
          }
        }
        const buffer = btoa(screen);
        await window.tapir.terminal(buffer, cols, rows);
        log('Terminal updated!');
      } catch (e) {
        log('Terminal error: ' + e.message);
      }
    }
    
    async function clearTerminal() {
      try {
        await window.tapir.terminalClear();
        log('Terminal cleared!');
      } catch (e) {
        log('Clear error: ' + e.message);
      }
    }
    
    // Listen for button events from device
    window.tapir.on('button', (data) => {
      log('Button ' + data.id + ': ' + data.event);
    });
    
    // Listen for connection changes
    window.tapir.on('connection', (data) => {
      log('Connection: ' + data.state);
      updateStatus();
    });
    
    // Initial status update
    setTimeout(updateStatus, 500);
  </script>
</body>
</html>
`;

// ============================================================================
// Component
// ============================================================================

export const MiniAppScreen: React.FC = observer(() => {
  const navigation = useNavigation();
  const miniAppRef = useRef<MiniAppViewRef>(null);
  const [url, setUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Forward button events to WebView
  useEffect(() => {
    deviceStore.onKeypress((keyIndex: number, event: KeyEvent) => {
      miniAppRef.current?.emit({
        type: 'button',
        data: {
          id: keyIndex,
          event: event === KeyEvent.DOWN ? 'down' : 'up',
        },
      });
    });
  }, []);

  const handleLoadUrl = () => {
    if (url.trim()) {
      setShowUrlInput(false);
      // The URL will be loaded when we update source
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#11111b" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mini-App</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => miniAppRef.current?.reload()}
          >
            <Text style={styles.headerButtonText}>↻</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowUrlInput(!showUrlInput)}
          >
            <Text style={styles.headerButtonText}>🌐</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* URL Input */}
      {showUrlInput && (
        <View style={styles.urlInputContainer}>
          <TextInput
            style={styles.urlInput}
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com"
            placeholderTextColor="#6c7086"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity style={styles.urlButton} onPress={handleLoadUrl}>
            <Text style={styles.urlButtonText}>Load</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* WebView */}
      <MiniAppView
        ref={miniAppRef}
        source={url.trim() ? { uri: url } : { html: DEMO_HTML }}
        appId="demo"
        onLoad={() => console.log('Mini-App loaded')}
        onError={(error) => console.error('Mini-App error:', error)}
        style={styles.webview}
      />
    </View>
  );
});

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#11111b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#cdd6f4',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#cdd6f4',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e2e',
    borderRadius: 8,
  },
  headerButtonText: {
    fontSize: 18,
  },
  urlInputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1e1e2e',
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#313244',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#cdd6f4',
    fontSize: 14,
  },
  urlButton: {
    backgroundColor: '#89b4fa',
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlButtonText: {
    color: '#11111b',
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
});

