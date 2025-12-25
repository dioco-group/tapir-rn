/**
 * MiniAppView - WebView wrapper for sandboxed Mini-Apps
 * 
 * Provides:
 * - Isolated WebView sandbox
 * - Bridge injection (window.tapir)
 * - Message handling
 * - Event emission to the WebView
 */

import React, { useRef, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { reaction } from 'mobx';
import { bridgeHandler, BRIDGE_INJECT_JS } from '../bridge';
import { BridgeRequest, BridgeEvent } from '../types/bridge';
import { notificationStore, deviceStore } from '../stores';

// ============================================================================
// Types
// ============================================================================

export interface MiniAppViewProps {
  /** URL or HTML content to load */
  source: { uri: string } | { html: string };
  /** Unique ID for sandboxed storage */
  appId?: string;
  /** Called when the WebView loads */
  onLoad?: () => void;
  /** Called on errors */
  onError?: (error: string) => void;
  /** Style */
  style?: object;
}

export interface MiniAppViewRef {
  /** Emit an event to the WebView */
  emit: (event: BridgeEvent) => void;
  /** Reload the WebView */
  reload: () => void;
  /** Go back in history */
  goBack: () => void;
  /** Execute JavaScript in the WebView */
  injectJS: (js: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const MiniAppView = forwardRef<MiniAppViewRef, MiniAppViewProps>(
  ({ source, appId = 'default', onLoad, onError, style }, ref) => {
    const webViewRef = useRef<WebView>(null);

    // Set the current mini-app ID for sandboxed storage
    useEffect(() => {
      bridgeHandler.setMiniAppId(appId);
    }, [appId]);

    // Forward notifications to WebView
    useEffect(() => {
      const unsubscribe = notificationStore.onNotification((notification) => {
        webViewRef.current?.injectJavaScript(`
          window.tapir.emit('notification', ${JSON.stringify({
            app: notification.app,
            title: notification.title,
            text: notification.text,
            timestamp: notification.timestamp,
          })});
          true;
        `);
      });
      
      return () => unsubscribe();
    }, []);

    // Forward connection state changes to WebView
    useEffect(() => {
      const disposer = reaction(
        () => deviceStore.isConnected,
        (isConnected) => {
          webViewRef.current?.injectJavaScript(`
            window.tapir._connected = ${isConnected};
            window.tapir.emit('connectionChange', ${isConnected});
            true;
          `);
        }
      );
      
      return () => disposer();
    }, []);

    // Emit initial connection state when WebView loads
    const handleLoad = useCallback(() => {
      // Set initial connection state
      webViewRef.current?.injectJavaScript(`
        window.tapir._connected = ${deviceStore.isConnected};
        window.tapir.emit('connectionChange', ${deviceStore.isConnected});
        true;
      `);
      onLoad?.();
    }, [onLoad]);

    // Handle messages from WebView
    const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
      try {
        const request: BridgeRequest = JSON.parse(event.nativeEvent.data);
        const response = await bridgeHandler.processRequest(request);
        
        // Send response back to WebView
        webViewRef.current?.injectJavaScript(`
          window.tapir._handleResponse(${JSON.stringify(response)});
          true;
        `);
      } catch (error) {
        console.error('[MiniAppView] Message handling error:', error);
      }
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      emit: (event: BridgeEvent) => {
        webViewRef.current?.injectJavaScript(`
          window.tapir.emit('${event.type}', ${JSON.stringify(event.data)});
          true;
        `);
      },
      reload: () => {
        webViewRef.current?.reload();
      },
      goBack: () => {
        webViewRef.current?.goBack();
      },
      injectJS: (js: string) => {
        webViewRef.current?.injectJavaScript(js);
      },
    }), []);

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          source={source}
          style={styles.webview}
          injectedJavaScriptBeforeContentLoaded={BRIDGE_INJECT_JS}
          onMessage={handleMessage}
          onLoad={handleLoad}
          onError={(e) => onError?.(e.nativeEvent.description)}
          // Security settings
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="compatibility"
          // Performance
          cacheEnabled={true}
          // Debugging (disable in production)
          webviewDebuggingEnabled={__DEV__}
        />
      </View>
    );
  }
);

MiniAppView.displayName = 'MiniAppView';

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

