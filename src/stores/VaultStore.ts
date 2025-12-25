/**
 * VaultStore - MobX store for API key management
 * 
 * Manages:
 * - API key storage (OpenAI, Anthropic, custom)
 * - Key validation
 * - Proxied API calls
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { storageService } from '../services';

// ============================================================================
// API Providers
// ============================================================================

export interface ApiProvider {
  id: string;
  name: string;
  keyPrefix?: string; // e.g., 'sk-' for OpenAI
  hasKey: boolean;
}

class VaultStore {
  // Loaded state
  isLoaded: boolean = false;
  
  // Key presence flags (we don't store actual keys in memory)
  hasOpenAiKey: boolean = false;
  hasAnthropicKey: boolean = false;
  customKeyNames: string[] = [];
  
  // Device identity
  deviceId: string = '';

  constructor() {
    makeAutoObservable(this);
    this.load();
  }

  // ==========================================================================
  // Computed
  // ==========================================================================

  get providers(): ApiProvider[] {
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        keyPrefix: 'sk-',
        hasKey: this.hasOpenAiKey,
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        keyPrefix: 'sk-ant-',
        hasKey: this.hasAnthropicKey,
      },
      ...this.customKeyNames.map((name) => ({
        id: `custom:${name}`,
        name,
        hasKey: true,
      })),
    ];
  }

  get hasAnyApiKey(): boolean {
    return this.hasOpenAiKey || this.hasAnthropicKey || this.customKeyNames.length > 0;
  }

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Load vault state from storage
   */
  load(): void {
    runInAction(() => {
      this.deviceId = storageService.getDeviceId();
      this.hasOpenAiKey = !!storageService.getOpenAiKey();
      this.hasAnthropicKey = !!storageService.getAnthropicKey();
      this.customKeyNames = Object.keys(storageService.getAllCustomKeys());
      this.isLoaded = true;
    });
  }

  /**
   * Set OpenAI API key
   */
  setOpenAiKey(key: string): void {
    storageService.setOpenAiKey(key);
    runInAction(() => {
      this.hasOpenAiKey = !!key.trim();
    });
  }

  /**
   * Set Anthropic API key
   */
  setAnthropicKey(key: string): void {
    storageService.setAnthropicKey(key);
    runInAction(() => {
      this.hasAnthropicKey = !!key.trim();
    });
  }

  /**
   * Set a custom API key
   */
  setCustomKey(name: string, value: string): void {
    storageService.setCustomKey(name, value);
    runInAction(() => {
      if (value.trim()) {
        if (!this.customKeyNames.includes(name)) {
          this.customKeyNames.push(name);
        }
      } else {
        this.customKeyNames = this.customKeyNames.filter((n) => n !== name);
      }
    });
  }

  /**
   * Delete a custom API key
   */
  deleteCustomKey(name: string): void {
    this.setCustomKey(name, '');
  }

  /**
   * Clear all API keys
   */
  clearAllKeys(): void {
    storageService.setOpenAiKey('');
    storageService.setAnthropicKey('');
    for (const name of this.customKeyNames) {
      storageService.setCustomKey(name, '');
    }
    runInAction(() => {
      this.hasOpenAiKey = false;
      this.hasAnthropicKey = false;
      this.customKeyNames = [];
    });
  }

  // ==========================================================================
  // Proxied API Calls
  // ==========================================================================

  /**
   * Make a chat completion request via OpenAI
   * This is the "Proxy" pattern - Mini-Apps call this, we attach the key
   */
  async chatCompletion(
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<string> {
    const apiKey = storageService.getOpenAiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { model = 'gpt-4o-mini', maxTokens = 1000, systemPrompt } = options;

    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Device-ID': this.deviceId, // Include device ID for future auth
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content ?? '';
  }

  /**
   * Make a chat completion request via Anthropic
   */
  async anthropicChat(
    prompt: string,
    options: {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<string> {
    const apiKey = storageService.getAnthropicKey();
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const { model = 'claude-sonnet-4-20250514', maxTokens = 1000, systemPrompt } = options;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'X-Device-ID': this.deviceId,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.content[0]?.text ?? '';
  }
}

// Export singleton
export const vaultStore = new VaultStore();

