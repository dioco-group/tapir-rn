/**
 * SimulatorScreen - Mini-app with device preview
 * 
 * Split view:
 * - Left: WebView with mini-app
 * - Right: Device simulator with live terminal
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import { MiniAppView, MiniAppViewRef } from '../components/MiniAppView';
import { DeviceSimulator } from '../components/DeviceSimulator';
import { deviceStore, launcherStore, terminalStore } from '../stores';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_URL = 'https://dioco-group.github.io/tapir-miniapps/launcher.html';

// ============================================================================
// Component
// ============================================================================

export const SimulatorScreen: React.FC = observer(() => {
  const navigation = useNavigation();
  const webViewRef = useRef<MiniAppViewRef>(null);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL);
  const [ledColors, setLedColors] = useState<{ [key: number]: { r: number; g: number; b: number } }>({});

  // Watch for launcher navigation
  useEffect(() => {
    if (launcherStore.isInApp && launcherStore.currentAppUrl) {
      // Launching an app
      console.log('[Simulator] Navigating to app:', launcherStore.currentAppUrl);
      setUrl(launcherStore.currentAppUrl);
      setInputUrl(launcherStore.currentAppUrl);
    } else if (launcherStore.isInLauncher && url !== DEFAULT_URL) {
      // Going back to launcher
      console.log('[Simulator] Returning to launcher');
      setUrl(DEFAULT_URL);
      setInputUrl(DEFAULT_URL);
    }
  }, [launcherStore.isInApp, launcherStore.currentAppUrl, launcherStore.isInLauncher]);

  // Handle button press from simulator
  // Buttons 9=Back, 10=Home, 11=Menu are handled at native level
  const handleButtonPress = useCallback((index: number) => {
    console.log('[Simulator] Button press:', index);
    
    // System buttons: always handled at native level
    if (index === 9) {
      // Back button - go home if in app
      if (launcherStore.isInApp) {
        console.log('[Simulator] Back pressed - going home');
        launcherStore.goBack();
        return; // Don't forward to WebView
      }
    } else if (index === 10) {
      // Home button - always go home
      if (launcherStore.isInApp) {
        console.log('[Simulator] Home pressed - going home');
        launcherStore.goHome();
        return; // Don't forward to WebView
      }
    }
    // Button 11 (Menu) could be forwarded for app-specific menus
    
    // Forward to WebView for app/launcher to handle
    webViewRef.current?.emit({
      type: 'button',
      data: { id: index, event: 'down' },
    });
  }, []);

  const handleButtonRelease = useCallback((index: number) => {
    console.log('[Simulator] Button release:', index);
    
    // Don't forward system button releases when they were handled natively
    if ((index === 9 || index === 10) && launcherStore.isInLauncher) {
      // We just went back to launcher, don't forward
      return;
    }
    
    webViewRef.current?.emit({
      type: 'button',
      data: { id: index, event: 'up' },
    });
  }, []);

  // Handle URL load
  const handleLoadUrl = useCallback(() => {
    setUrl(inputUrl);
  }, [inputUrl]);

  // Demo LED animation
  const handleDemoLeds = useCallback(() => {
    // Cycle through colors
    const colors = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 255, g: 255, b: 0 },
    ];
    
    let i = 0;
    const interval = setInterval(() => {
      const newColors: typeof ledColors = {};
      for (let j = 0; j < 12; j++) {
        const colorIndex = (i + j) % colors.length;
        newColors[j] = colors[colorIndex];
      }
      setLedColors(newColors);
      i++;
      if (i > 20) {
        clearInterval(interval);
        setLedColors({});
      }
    }, 100);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#11111b" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Simulator</Text>
        <TouchableOpacity style={styles.demoButton} onPress={handleDemoLeds}>
          <Text style={styles.demoIcon}>💡</Text>
        </TouchableOpacity>
      </View>

      {/* URL Input */}
      <View style={styles.urlBar}>
        <TextInput
          style={styles.urlInput}
          value={inputUrl}
          onChangeText={setInputUrl}
          placeholder="Mini-app URL"
          placeholderTextColor="#6c7086"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onSubmitEditing={handleLoadUrl}
        />
        <TouchableOpacity style={styles.loadButton} onPress={handleLoadUrl}>
          <Text style={styles.loadButtonText}>Load</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content - Split View */}
      <View style={styles.content}>
        {/* Left: WebView */}
        <View style={styles.webViewContainer}>
          <MiniAppView
            ref={webViewRef}
            source={{ uri: url }}
            appId="simulator"
            onError={(error) => console.error('[Simulator] WebView error:', error)}
          />
        </View>

        {/* Right: Device Simulator */}
        <ScrollView 
          style={styles.simulatorContainer}
          contentContainerStyle={styles.simulatorContent}
          showsVerticalScrollIndicator={false}
        >
          <DeviceSimulator
            onButtonPress={handleButtonPress}
            onButtonRelease={handleButtonRelease}
            ledColors={ledColors}
            showTriggers={true}
          />

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => terminalStore.clear()}
            >
              <Text style={styles.quickActionText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => terminalStore.fillTestPattern()}
            >
              <Text style={styles.quickActionText}>Test</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => webViewRef.current?.reload()}
            >
              <Text style={styles.quickActionText}>↻</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.stats}>
            <Text style={styles.statText}>
              FPS: {terminalStore.fps.toFixed(1)}
            </Text>
            <Text style={styles.statText}>
              Buffer: {terminalStore.cols}×{terminalStore.rows}
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e1e2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 18,
    color: '#cdd6f4',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#cdd6f4',
  },
  demoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e1e2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoIcon: {
    fontSize: 16,
  },
  urlBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#1e1e2e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#cdd6f4',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#313244',
  },
  loadButton: {
    backgroundColor: '#89b4fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadButtonText: {
    color: '#11111b',
    fontWeight: '600',
    fontSize: 13,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  webViewContainer: {
    flex: 2, // 2/3 of width
    borderRightWidth: 1,
    borderRightColor: '#313244',
  },
  simulatorContainer: {
    flex: 1, // 1/3 of width
    backgroundColor: '#181825',
  },
  simulatorContent: {
    padding: 10,
    alignItems: 'center',
    paddingBottom: 20,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  quickAction: {
    backgroundColor: '#313244',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickActionText: {
    color: '#cdd6f4',
    fontSize: 11,
    fontWeight: '500',
  },
  stats: {
    marginTop: 12,
    alignItems: 'center',
  },
  statText: {
    color: '#6c7086',
    fontSize: 10,
  },
});

