/**
 * Bridge Handler - Processes messages from Mini-Apps (WebView)
 * 
 * Mini-Apps call: window.tapir.call('method', params)
 * This handler processes those calls and returns results.
 */

import { Buffer } from 'buffer';
import { bleService, storageService } from '../services';
import { deviceStore, terminalStore, vaultStore, launcherStore } from '../stores';
import {
  BridgeRequest,
  BridgeResponse,
  BridgeMethod,
  LedControlParams,
  TerminalUpdateParams,
  AiChatParams,
  StorageGetParams,
  StorageSetParams,
  TtsSpeakParams,
  LauncherLaunchParams,
  LauncherUpdateAppParams,
} from '../types/bridge';

// ============================================================================
// Bridge Handler
// ============================================================================

class BridgeHandler {
  private currentMiniAppId: string = 'default';

  /**
   * Set the current mini-app ID (for sandboxed storage)
   */
  setMiniAppId(appId: string): void {
    this.currentMiniAppId = appId;
  }

  /**
   * Process a bridge request from the WebView
   */
  async processRequest(request: BridgeRequest): Promise<BridgeResponse> {
    const { id, method, params } = request;

    try {
      const result = await this.handleMethod(method, params);
      return { id, result };
    } catch (error) {
      return {
        id,
        error: {
          code: 'BRIDGE_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Handle a specific method call
   */
  private async handleMethod(
    method: BridgeMethod,
    params: Record<string, unknown>
  ): Promise<unknown> {
    switch (method) {
      // ==== Device Control ====
      
      case 'led':
        return this.handleLed(params as unknown as LedControlParams);
        
      case 'terminal':
        return this.handleTerminal(params as unknown as TerminalUpdateParams);
        
      case 'terminalClear':
        return this.handleTerminalClear();
        
      case 'echo':
        return this.handleEcho(params as unknown as { data: string });
        
      // ==== AI Proxy ====
      
      case 'ai.chat':
        return this.handleAiChat(params as unknown as AiChatParams);
        
      // ==== Storage ====
      
      case 'storage.get':
        return this.handleStorageGet(params as unknown as StorageGetParams);
        
      case 'storage.set':
        return this.handleStorageSet(params as unknown as StorageSetParams);
        
      // ==== TTS ====
      
      case 'tts.speak':
        return this.handleTtsSpeak(params as unknown as TtsSpeakParams);
        
      // ==== Device Info ====
      
      case 'device.info':
        return this.handleDeviceInfo();
        
      case 'device.vibrate':
        return this.handleVibrate();
        
      // ==== Launcher ====
      
      case 'launcher.launch':
        return this.handleLauncherLaunch(params as unknown as LauncherLaunchParams);
        
      case 'launcher.home':
        return this.handleLauncherHome();
        
      case 'launcher.back':
        return this.handleLauncherBack();
        
      case 'launcher.getApps':
        return this.handleLauncherGetApps();
        
      case 'launcher.updateApp':
        return this.handleLauncherUpdateApp(params as unknown as LauncherUpdateAppParams);
        
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  // ==========================================================================
  // Method Handlers
  // ==========================================================================

  private async handleLed(params: LedControlParams): Promise<void> {
    const { index, r, g, b } = params;
    
    // Only send to device if connected, but don't block simulator mode
    if (deviceStore.isConnected) {
      await bleService.sendLedControl(index, r, g, b);
    }
    // TODO: Track LED state locally for simulator display
  }

  private async handleTerminal(params: TerminalUpdateParams): Promise<void> {
    const { buffer, cols = 32, rows = 18 } = params;
    
    // Decode base64 buffer
    const data = Buffer.from(buffer, 'base64');
    
    // Always update terminal store (for simulator display)
    terminalStore.setSize(cols, rows);
    terminalStore.setBuffer(new Uint8Array(data));
    
    // Only flush to device if connected
    if (deviceStore.isConnected) {
      await terminalStore.flush();
    }
  }

  private async handleTerminalClear(): Promise<void> {
    // Always clear terminal store (for simulator display)
    terminalStore.clear();
    
    // Only send to device if connected
    if (deviceStore.isConnected) {
      await terminalStore.clearDevice();
    }
  }

  private async handleEcho(params: { data: string }): Promise<void> {
    if (!deviceStore.isConnected) {
      throw new Error('Device not connected');
    }
    
    await bleService.sendEcho(params.data);
  }

  private async handleAiChat(params: AiChatParams): Promise<{ text: string }> {
    const { prompt, model, maxTokens } = params;
    
    // Try OpenAI first, then Anthropic
    if (vaultStore.hasOpenAiKey) {
      const text = await vaultStore.chatCompletion(prompt, { model, maxTokens });
      return { text };
    }
    
    if (vaultStore.hasAnthropicKey) {
      const text = await vaultStore.anthropicChat(prompt, { model, maxTokens });
      return { text };
    }
    
    throw new Error('No AI API key configured');
  }

  private handleStorageGet(params: StorageGetParams): { value: string | null } {
    const value = storageService.getMiniAppValue(this.currentMiniAppId, params.key);
    return { value };
  }

  private handleStorageSet(params: StorageSetParams): void {
    storageService.setMiniAppValue(this.currentMiniAppId, params.key, params.value);
  }

  private async handleTtsSpeak(params: TtsSpeakParams): Promise<void> {
    // TODO: Implement with expo-speech
    console.log('[Bridge] TTS speak:', params.text);
    throw new Error('TTS not yet implemented');
  }

  private handleDeviceInfo(): Record<string, unknown> {
    return {
      connected: deviceStore.isConnected,
      deviceId: deviceStore.connectedDeviceId,
      deviceName: deviceStore.connectedDeviceName,
      mtu: deviceStore.mtu,
      batteryLevel: deviceStore.batteryLevel,
      terminalCols: terminalStore.cols,
      terminalRows: terminalStore.rows,
      fps: terminalStore.fps,
    };
  }

  private async handleVibrate(): Promise<void> {
    // TODO: Implement with expo-haptics
    console.log('[Bridge] Vibrate');
  }

  // ==========================================================================
  // Launcher Handlers
  // ==========================================================================

  private handleLauncherLaunch(params: LauncherLaunchParams): void {
    launcherStore.launchApp(params.index);
  }

  private handleLauncherHome(): void {
    launcherStore.goHome();
  }

  private handleLauncherBack(): void {
    launcherStore.goBack();
  }

  private handleLauncherGetApps(): { apps: typeof launcherStore.apps } {
    return { apps: launcherStore.apps };
  }

  private handleLauncherUpdateApp(params: LauncherUpdateAppParams): void {
    launcherStore.updateApp(params.index, params);
  }
}

// Export singleton
export const bridgeHandler = new BridgeHandler();

// ============================================================================
// Injected JavaScript for WebView
// ============================================================================

/**
 * JavaScript to inject into WebView to set up the bridge
 */
export const BRIDGE_INJECT_JS = `
(function() {
  // Request/response tracking
  const pendingRequests = new Map();
  let requestId = 0;

  // Bridge API
  window.tapir = {
    // Call a native method
    call: function(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = String(++requestId);
        pendingRequests.set(id, { resolve, reject });
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          id,
          method,
          params
        }));
        
        // Timeout after 30s
        setTimeout(() => {
          if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            reject(new Error('Request timeout'));
          }
        }, 30000);
      });
    },
    
    // Event listeners
    _listeners: {},
    
    on: function(event, callback) {
      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }
      this._listeners[event].push(callback);
    },
    
    off: function(event, callback) {
      if (!this._listeners[event]) return;
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    },
    
    // Called by native to deliver response
    _handleResponse: function(response) {
      const { id, result, error } = response;
      const pending = pendingRequests.get(id);
      if (pending) {
        pendingRequests.delete(id);
        if (error) {
          pending.reject(new Error(error.message));
        } else {
          pending.resolve(result);
        }
      }
    },
    
    // Called by native to emit events
    emit: function(type, data) {
      const listeners = this._listeners[type];
      if (listeners) {
        listeners.forEach(cb => cb(data));
      }
    }
  };
  
  // Convenience methods
  window.tapir.led = (index, r, g, b) => window.tapir.call('led', { index, r, g, b });
  window.tapir.terminal = (buffer, cols, rows) => window.tapir.call('terminal', { buffer, cols, rows });
  window.tapir.terminalClear = () => window.tapir.call('terminalClear');
  window.tapir.echo = (data) => window.tapir.call('echo', { data });
  window.tapir.ai = {
    chat: (prompt, options) => window.tapir.call('ai.chat', { prompt, ...options })
  };
  window.tapir.storage = {
    get: (key) => window.tapir.call('storage.get', { key }).then(r => r.value),
    set: (key, value) => window.tapir.call('storage.set', { key, value })
  };
  window.tapir.tts = {
    speak: (text, options) => window.tapir.call('tts.speak', { text, ...options })
  };
  window.tapir.device = {
    info: () => window.tapir.call('device.info'),
    vibrate: () => window.tapir.call('device.vibrate')
  };
  
  // Connection state (updated by native events)
  window.tapir._connected = false;
  window.tapir.isConnected = function() { return window.tapir._connected; };
  
  // Listen for connection changes to update state
  window.tapir.on('connectionChange', function(isConnected) {
    window.tapir._connected = isConnected;
  });
  
  console.log('[Tapir Bridge] Initialized');
})();
true;
`;

