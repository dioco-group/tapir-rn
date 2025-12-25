/**
 * LauncherStore - MobX store for managing app launcher
 * 
 * Manages:
 * - 9 configurable app slots
 * - Current active app
 * - Navigation between launcher and apps
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { storageService } from '../services';

// ============================================================================
// Types
// ============================================================================

export interface AppSlot {
  id: number;           // 0-8 for the 9 app slots
  name: string;         // Display name (max ~10 chars)
  icon: string;         // Single emoji or 2-char icon
  url: string;          // URL to load (can be http, https, or bundled)
  enabled: boolean;     // Whether the slot is configured
}

export type LauncherState = 'launcher' | 'app';

// Default app configurations
const DEFAULT_APPS: AppSlot[] = [
  { id: 0, name: 'Pager', icon: '📟', url: 'https://dioco-group.github.io/tapir-miniapps/pager.html', enabled: true },
  { id: 1, name: 'Clock', icon: '🕐', url: '', enabled: false },
  { id: 2, name: 'Notes', icon: '📝', url: '', enabled: false },
  { id: 3, name: 'Calc', icon: '🔢', url: '', enabled: false },
  { id: 4, name: 'Timer', icon: '⏱️', url: '', enabled: false },
  { id: 5, name: 'Snake', icon: '🐍', url: '', enabled: false },
  { id: 6, name: 'Chat', icon: '💬', url: '', enabled: false },
  { id: 7, name: 'Music', icon: '🎵', url: '', enabled: false },
  { id: 8, name: 'Radio', icon: '📻', url: '', enabled: false },
];

// Storage key for apps
const APPS_STORAGE_KEY = 'launcher_apps';

// ============================================================================
// LauncherStore
// ============================================================================

class LauncherStore {
  // App slots (3x3 grid = 9 apps)
  apps: AppSlot[] = [...DEFAULT_APPS];
  
  // Current state
  state: LauncherState = 'launcher';
  
  // Currently active app index (-1 = launcher/home)
  activeAppIndex: number = -1;
  
  // Selected slot on launcher (for cursor highlight)
  selectedSlot: number = 0;

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  // ==========================================================================
  // Computed
  // ==========================================================================

  get activeApp(): AppSlot | null {
    if (this.activeAppIndex < 0 || this.activeAppIndex > 8) return null;
    return this.apps[this.activeAppIndex];
  }

  get isInApp(): boolean {
    return this.state === 'app' && this.activeApp !== null;
  }

  get isInLauncher(): boolean {
    return this.state === 'launcher';
  }

  get currentAppUrl(): string | null {
    return this.activeApp?.url ?? null;
  }

  get enabledApps(): AppSlot[] {
    return this.apps.filter(app => app.enabled);
  }

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Load app configurations from storage
   */
  loadFromStorage(): void {
    try {
      const stored = storageService.getMiniAppValue('__launcher__', APPS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppSlot[];
        if (Array.isArray(parsed) && parsed.length === 9) {
          runInAction(() => {
            this.apps = parsed;
          });
        }
      }
    } catch (e) {
      console.error('[LauncherStore] Failed to load apps:', e);
    }
  }

  /**
   * Save app configurations to storage
   */
  saveToStorage(): void {
    try {
      storageService.setMiniAppValue(
        '__launcher__',
        APPS_STORAGE_KEY,
        JSON.stringify(this.apps)
      );
    } catch (e) {
      console.error('[LauncherStore] Failed to save apps:', e);
    }
  }

  /**
   * Update an app slot
   */
  updateApp(index: number, updates: Partial<AppSlot>): void {
    if (index < 0 || index > 8) return;
    
    runInAction(() => {
      this.apps[index] = {
        ...this.apps[index],
        ...updates,
        id: index, // Ensure id is always correct
      };
    });
    
    this.saveToStorage();
  }

  /**
   * Launch an app by index (0-8)
   */
  launchApp(index: number): void {
    if (index < 0 || index > 8) return;
    
    const app = this.apps[index];
    if (!app.enabled || !app.url) {
      console.log('[LauncherStore] App not configured:', index);
      return;
    }

    runInAction(() => {
      this.activeAppIndex = index;
      this.state = 'app';
    });
    
    console.log('[LauncherStore] Launching app:', app.name, app.url);
  }

  /**
   * Go back to launcher (Home button)
   */
  goHome(): void {
    runInAction(() => {
      this.state = 'launcher';
      this.activeAppIndex = -1;
    });
    
    console.log('[LauncherStore] Going home');
  }

  /**
   * Go back (context-dependent)
   * - If in app: go to launcher
   * - If in launcher: do nothing (or could minimize)
   */
  goBack(): void {
    if (this.state === 'app') {
      this.goHome();
    }
  }

  /**
   * Handle physical button press (0-11)
   * Returns true if handled, false otherwise
   */
  handleButton(buttonIndex: number): boolean {
    console.log('[LauncherStore] Button pressed:', buttonIndex);
    
    // Buttons 9-11 are system buttons (Back, Home, Menu)
    if (buttonIndex === 9) {
      // Back button
      this.goBack();
      return true;
    }
    
    if (buttonIndex === 10) {
      // Home button
      this.goHome();
      return true;
    }
    
    if (buttonIndex === 11) {
      // Menu button - could open settings overlay
      console.log('[LauncherStore] Menu button - not implemented');
      return true;
    }
    
    // Buttons 0-8 are app buttons
    if (buttonIndex >= 0 && buttonIndex <= 8) {
      if (this.state === 'launcher') {
        // Launch the app
        this.launchApp(buttonIndex);
      } else {
        // Forward to active app (return false to let app handle it)
        return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Move selection in launcher grid
   */
  moveSelection(direction: 'up' | 'down' | 'left' | 'right'): void {
    if (this.state !== 'launcher') return;
    
    let newSlot = this.selectedSlot;
    
    switch (direction) {
      case 'up':
        newSlot = this.selectedSlot < 3 ? this.selectedSlot + 6 : this.selectedSlot - 3;
        break;
      case 'down':
        newSlot = this.selectedSlot > 5 ? this.selectedSlot - 6 : this.selectedSlot + 3;
        break;
      case 'left':
        newSlot = this.selectedSlot % 3 === 0 ? this.selectedSlot + 2 : this.selectedSlot - 1;
        break;
      case 'right':
        newSlot = this.selectedSlot % 3 === 2 ? this.selectedSlot - 2 : this.selectedSlot + 1;
        break;
    }
    
    runInAction(() => {
      this.selectedSlot = newSlot;
    });
  }

  /**
   * Reset all apps to defaults
   */
  resetToDefaults(): void {
    runInAction(() => {
      this.apps = [...DEFAULT_APPS];
    });
    this.saveToStorage();
  }
}

// Export singleton
export const launcherStore = new LauncherStore();

