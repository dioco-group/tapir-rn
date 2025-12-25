/**
 * Storage Service - Encrypted persistent storage using MMKV
 * 
 * Handles:
 * - Device identity (generated UUID for auth until firmware key is ready)
 * - API keys vault (OpenAI, etc.)
 * - App preferences
 * - Mini-app data (sandboxed per app)
 */

import { createMMKV } from 'react-native-mmkv';

// ============================================================================
// Storage Instances
// ============================================================================

// Main storage for app settings and device identity
const mainStorage = createMMKV({
  id: 'tapir-main',
  encryptionKey: 'tapir-2024-enc-key', // In production, derive from secure source
});

// Vault for sensitive API keys
const vaultStorage = createMMKV({
  id: 'tapir-vault',
  encryptionKey: 'tapir-vault-enc-key',
});

// ============================================================================
// Storage Keys
// ============================================================================

const KEYS = {
  // Device identity
  DEVICE_ID: 'device_id',
  DEVICE_NAME: 'device_name',
  LAST_CONNECTED_DEVICE: 'last_connected_device',
  
  // Vault keys
  OPENAI_API_KEY: 'openai_api_key',
  ANTHROPIC_API_KEY: 'anthropic_api_key',
  CUSTOM_API_KEYS: 'custom_api_keys',
  
  // Settings
  AUTO_CONNECT: 'auto_connect',
  THEME: 'theme',
} as const;

// ============================================================================
// Storage Service
// ============================================================================

class StorageService {
  // ==========================================================================
  // Device Identity
  // ==========================================================================

  /**
   * Get or generate the device identity UUID
   * This serves as the "device key" until firmware signing is implemented
   */
  getDeviceId(): string {
    let deviceId = mainStorage.getString(KEYS.DEVICE_ID);
    
    if (!deviceId) {
      // Generate a new UUID
      deviceId = this.generateUUID();
      mainStorage.set(KEYS.DEVICE_ID, deviceId);
      console.log('[Storage] Generated new device ID:', deviceId);
    }
    
    return deviceId;
  }

  /**
   * Get the last connected BLE device ID
   */
  getLastConnectedDevice(): string | null {
    return mainStorage.getString(KEYS.LAST_CONNECTED_DEVICE) ?? null;
  }

  /**
   * Save the last connected BLE device ID
   */
  setLastConnectedDevice(bleDeviceId: string): void {
    mainStorage.set(KEYS.LAST_CONNECTED_DEVICE, bleDeviceId);
  }

  // ==========================================================================
  // Vault (API Keys)
  // ==========================================================================

  /**
   * Get OpenAI API key
   */
  getOpenAiKey(): string | null {
    return vaultStorage.getString(KEYS.OPENAI_API_KEY) ?? null;
  }

  /**
   * Set OpenAI API key
   */
  setOpenAiKey(key: string): void {
    if (key.trim()) {
      vaultStorage.set(KEYS.OPENAI_API_KEY, key.trim());
    } else {
      vaultStorage.remove(KEYS.OPENAI_API_KEY);
    }
  }

  /**
   * Get Anthropic API key
   */
  getAnthropicKey(): string | null {
    return vaultStorage.getString(KEYS.ANTHROPIC_API_KEY) ?? null;
  }

  /**
   * Set Anthropic API key
   */
  setAnthropicKey(key: string): void {
    if (key.trim()) {
      vaultStorage.set(KEYS.ANTHROPIC_API_KEY, key.trim());
    } else {
      vaultStorage.remove(KEYS.ANTHROPIC_API_KEY);
    }
  }

  /**
   * Get a custom API key by name
   */
  getCustomKey(name: string): string | null {
    const keys = this.getAllCustomKeys();
    return keys[name] ?? null;
  }

  /**
   * Set a custom API key
   */
  setCustomKey(name: string, value: string): void {
    const keys = this.getAllCustomKeys();
    if (value.trim()) {
      keys[name] = value.trim();
    } else {
      delete keys[name];
    }
    vaultStorage.set(KEYS.CUSTOM_API_KEYS, JSON.stringify(keys));
  }

  /**
   * Get all custom API keys
   */
  getAllCustomKeys(): Record<string, string> {
    const raw = vaultStorage.getString(KEYS.CUSTOM_API_KEYS);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  /**
   * Check if any API keys are configured
   */
  hasApiKeys(): boolean {
    return !!(this.getOpenAiKey() || this.getAnthropicKey());
  }

  // ==========================================================================
  // Settings
  // ==========================================================================

  /**
   * Get auto-connect preference
   */
  getAutoConnect(): boolean {
    return mainStorage.getBoolean(KEYS.AUTO_CONNECT) ?? true;
  }

  /**
   * Set auto-connect preference
   */
  setAutoConnect(value: boolean): void {
    mainStorage.set(KEYS.AUTO_CONNECT, value);
  }

  /**
   * Get theme preference
   */
  getTheme(): 'light' | 'dark' | 'system' {
    return (mainStorage.getString(KEYS.THEME) as 'light' | 'dark' | 'system') ?? 'system';
  }

  /**
   * Set theme preference
   */
  setTheme(theme: 'light' | 'dark' | 'system'): void {
    mainStorage.set(KEYS.THEME, theme);
  }

  // ==========================================================================
  // Mini-App Storage (Sandboxed)
  // ==========================================================================

  /**
   * Get a value for a mini-app (sandboxed by app ID)
   */
  getMiniAppValue(appId: string, key: string): string | null {
    const storageKey = `miniapp:${appId}:${key}`;
    return mainStorage.getString(storageKey) ?? null;
  }

  /**
   * Set a value for a mini-app (sandboxed by app ID)
   */
  setMiniAppValue(appId: string, key: string, value: string): void {
    const storageKey = `miniapp:${appId}:${key}`;
    mainStorage.set(storageKey, value);
  }

  /**
   * Delete a mini-app value
   */
  deleteMiniAppValue(appId: string, key: string): void {
    const storageKey = `miniapp:${appId}:${key}`;
    mainStorage.remove(storageKey);
  }

  /**
   * Clear all data for a mini-app
   */
  clearMiniAppData(appId: string): void {
    const prefix = `miniapp:${appId}:`;
    const allKeys = mainStorage.getAllKeys();
    for (const key of allKeys) {
      if (key.startsWith(prefix)) {
        mainStorage.remove(key);
      }
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private generateUUID(): string {
    // Simple UUID v4 generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Clear all storage (for debugging/reset)
   */
  clearAll(): void {
    mainStorage.clearAll();
    vaultStorage.clearAll();
  }
}

// Export singleton
export const storageService = new StorageService();

