/**
 * SimulatorScreen - Mini-app with device preview
 * 
 * Split view:
 * - Left: WebView with mini-app
 * - Right: Device simulator with live terminal
 */

import React, { useRef, useState, useCallback } from 'react';
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

const DEFAULT_URL = 'https://dioco-group.github.io/tapir-miniapps/pager.html';

// ============================================================================
// Component
// ============================================================================

export const SimulatorScreen: React.FC = observer(() => {
  const navigation = useNavigation();
  const webViewRef = useRef<MiniAppViewRef>(null);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL);
  const [ledColors, setLedColors] = useState<{ [key: number]: { r: number; g: number; b: number } }>({});

  // Handle button press from simulator
  const handleButtonPress = useCallback((index: number) => {
    console.log('[Simulator] Button press:', index);
    
    // Send event to WebView
    webViewRef.current?.emit({
      type: 'button',
      data: { id: index, event: 'down' },
    });
  }, []);

  const handleButtonRelease = useCallback((index: number) => {
    console.log('[Simulator] Button release:', index);
    
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
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#313244',
  },
  simulatorContainer: {
    width: 140,
    backgroundColor: '#181825',
  },
  simulatorContent: {
    padding: 10,
    alignItems: 'center',
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

