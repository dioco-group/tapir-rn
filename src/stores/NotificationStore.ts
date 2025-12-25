/**
 * NotificationStore - MobX store for phone notifications
 * 
 * Listens for Android notifications and stores the recent ones.
 * Forwards notifications to any registered Mini-Apps.
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { AppState, AppStateStatus, Platform } from 'react-native';

// Conditionally import - may not be available until rebuild
let RNAndroidNotificationListener: any = null;
let RNAndroidNotificationListenerHeadlessJsName: string = 'RNAndroidNotificationListenerHeadlessJs';

try {
  const module = require('react-native-android-notification-listener');
  RNAndroidNotificationListener = module.default;
  RNAndroidNotificationListenerHeadlessJsName = module.RNAndroidNotificationListenerHeadlessJsName;
} catch (e) {
  console.log('[NotificationStore] Native module not available yet - rebuild required');
}

// ============================================================================
// Types
// ============================================================================

export interface AppNotification {
  id: string;
  app: string;
  title: string;
  text: string;
  timestamp: number;
}

// ============================================================================
// Notification Store
// ============================================================================

class NotificationStore {
  // Recent notifications (max 10)
  notifications: AppNotification[] = [];
  
  // Permission status
  hasPermission: boolean = false;
  
  // Listener callbacks (for forwarding to mini-apps)
  private listeners: ((notification: AppNotification) => void)[] = [];

  constructor() {
    makeAutoObservable(this);
    this.init();
  }

  // ==========================================================================
  // Computed
  // ==========================================================================

  get recentNotifications(): AppNotification[] {
    return this.notifications.slice(0, 3);
  }

  get notificationCount(): number {
    return this.notifications.length;
  }

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Initialize notification listener
   */
  async init(): Promise<void> {
    if (Platform.OS !== 'android') {
      console.log('[NotificationStore] Only supported on Android');
      return;
    }

    // Check permission status
    await this.checkPermission();

    // Listen for app state changes to refresh permission
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  /**
   * Check if we have notification listener permission
   */
  async checkPermission(): Promise<boolean> {
    if (!RNAndroidNotificationListener) {
      console.log('[NotificationStore] Native module not available - rebuild required');
      return false;
    }
    
    try {
      const status = await RNAndroidNotificationListener.getPermissionStatus();
      runInAction(() => {
        this.hasPermission = status === 'authorized';
      });
      console.log('[NotificationStore] Permission status:', status);
      return this.hasPermission;
    } catch (error) {
      console.error('[NotificationStore] Permission check error:', error);
      return false;
    }
  }

  /**
   * Request notification listener permission (opens settings)
   */
  async requestPermission(): Promise<void> {
    if (!RNAndroidNotificationListener) {
      console.log('[NotificationStore] Native module not available - rebuild required');
      return;
    }
    
    try {
      await RNAndroidNotificationListener.requestPermission();
    } catch (error) {
      console.error('[NotificationStore] Request permission error:', error);
    }
  }
  
  /**
   * Check if native module is available
   */
  get isAvailable(): boolean {
    return RNAndroidNotificationListener !== null;
  }

  /**
   * Add a notification (called from headless JS task)
   */
  addNotification(notification: AppNotification): void {
    runInAction(() => {
      // Add to front of list
      this.notifications.unshift(notification);
      
      // Keep only last 10
      if (this.notifications.length > 10) {
        this.notifications = this.notifications.slice(0, 10);
      }
    });

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(notification);
      } catch (e) {
        console.error('[NotificationStore] Listener error:', e);
      }
    });

    console.log('[NotificationStore] New notification:', notification.app, notification.title);
  }

  /**
   * Register a listener for new notifications
   */
  onNotification(callback: (notification: AppNotification) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    runInAction(() => {
      this.notifications = [];
    });
  }

  // ==========================================================================
  // Private
  // ==========================================================================

  private handleAppStateChange(state: AppStateStatus): void {
    if (state === 'active') {
      // Re-check permission when app comes to foreground
      this.checkPermission();
    }
  }
}

// Export singleton
export const notificationStore = new NotificationStore();

// ============================================================================
// Headless JS Task Handler
// ============================================================================

/**
 * This function is called by the Android notification listener service
 * when a new notification is received (even when app is in background).
 */
export async function notificationHandler(notification: {
  app: string;
  title: string;
  text: string;
  time: string;
}): Promise<void> {
  console.log('[NotificationHandler] Received:', notification);
  
  // Create notification object
  const appNotification: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    app: notification.app || 'Unknown',
    title: notification.title || '',
    text: notification.text || '',
    timestamp: Date.now(),
  };
  
  // Add to store
  notificationStore.addNotification(appNotification);
}

// Export the headless task name for registration
export const NOTIFICATION_HANDLER_TASK = RNAndroidNotificationListenerHeadlessJsName;

