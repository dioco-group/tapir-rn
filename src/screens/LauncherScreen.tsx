/**
 * LauncherScreen - Main launcher with 9 app slots
 * 
 * Displays:
 * - 3x3 app grid when in launcher mode
 * - Active app WebView when an app is launched
 * - Handles physical button navigation (Back/Home/Menu)
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MiniAppView, MiniAppViewRef } from '../components/MiniAppView';
import { deviceStore, launcherStore } from '../stores';
import { KeyEvent } from '../types/protocol';
import { RootStackParamList } from './index';

// ============================================================================
// Types
// ============================================================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Launcher'>;

// ============================================================================
// App Slot Component
// ============================================================================

interface AppSlotProps {
  index: number;
  name: string;
  icon: string;
  enabled: boolean;
  isSelected: boolean;
  onPress: () => void;
}

const AppSlot: React.FC<AppSlotProps> = ({
  index,
  name,
  icon,
  enabled,
  isSelected,
  onPress,
}) => (
  <TouchableOpacity
    style={[
      styles.appSlot,
      !enabled && styles.appSlotDisabled,
      isSelected && styles.appSlotSelected,
    ]}
    onPress={onPress}
    disabled={!enabled}
    activeOpacity={0.7}
  >
    <Text style={styles.appNumber}>{index + 1}</Text>
    <Text style={styles.appIcon}>{icon}</Text>
    <Text style={[styles.appName, !enabled && styles.appNameDisabled]}>
      {name}
    </Text>
  </TouchableOpacity>
);

// ============================================================================
// Component
// ============================================================================

export const LauncherScreen: React.FC = observer(() => {
  const navigation = useNavigation<NavigationProp>();
  const webViewRef = useRef<MiniAppViewRef>(null);

  // Handle physical button presses from device
  useEffect(() => {
    const handleKeypress = (keyIndex: number, event: KeyEvent) => {
      if (event !== KeyEvent.DOWN) return;

      // If in app, forward button to app first
      if (launcherStore.isInApp) {
        // System buttons always handled by launcher
        if (keyIndex >= 9) {
          launcherStore.handleButton(keyIndex);
        } else {
          // Forward app buttons to WebView
          webViewRef.current?.emit({
            type: 'button',
            data: { id: keyIndex, event: 'down' },
          });
        }
      } else {
        // In launcher mode
        launcherStore.handleButton(keyIndex);
      }
    };

    deviceStore.onKeypress(handleKeypress);
    
    return () => {
      deviceStore.onKeypress(() => {});
    };
  }, []);

  // Handle app launch
  const handleAppPress = useCallback((index: number) => {
    launcherStore.launchApp(index);
  }, []);

  // Handle back button
  const handleBack = useCallback(() => {
    if (launcherStore.isInApp) {
      launcherStore.goHome();
    } else {
      navigation.goBack();
    }
  }, [navigation]);

  // Handle home button
  const handleHome = useCallback(() => {
    launcherStore.goHome();
  }, []);

  // Handle menu button (go to settings)
  const handleMenu = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  // ============================================================================
  // Render
  // ============================================================================

  // If an app is active, show the WebView
  if (launcherStore.isInApp && launcherStore.activeApp) {
    const activeApp = launcherStore.activeApp;
    
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#11111b" />
        
        {/* App Header */}
        <View style={styles.appHeader}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.appHeaderInfo}>
            <Text style={styles.appHeaderIcon}>{activeApp.icon}</Text>
            <Text style={styles.appHeaderTitle}>{activeApp.name}</Text>
          </View>
          <TouchableOpacity style={styles.homeButton} onPress={handleHome}>
            <Text style={styles.homeIcon}>⌂</Text>
          </TouchableOpacity>
        </View>

        {/* App WebView */}
        <MiniAppView
          ref={webViewRef}
          source={{ uri: activeApp.url }}
          appId={`app-${activeApp.id}`}
          onError={(error) => console.error('[LauncherScreen] WebView error:', error)}
        />
      </SafeAreaView>
    );
  }

  // Launcher grid view
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#11111b" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Launcher</Text>
        <TouchableOpacity style={styles.menuButton} onPress={handleMenu}>
          <Text style={styles.menuIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Connection status */}
      {!deviceStore.isConnected && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ Device not connected - apps will run in preview mode
          </Text>
        </View>
      )}

      {/* App Grid */}
      <View style={styles.gridContainer}>
        <View style={styles.grid}>
          {launcherStore.apps.map((app, index) => (
            <AppSlot
              key={app.id}
              index={index}
              name={app.name}
              icon={app.icon}
              enabled={app.enabled}
              isSelected={launcherStore.selectedSlot === index}
              onPress={() => handleAppPress(index)}
            />
          ))}
        </View>
      </View>

      {/* System Buttons Row */}
      <View style={styles.systemRow}>
        <TouchableOpacity style={styles.systemButton} onPress={handleBack}>
          <Text style={styles.systemIcon}>←</Text>
          <Text style={styles.systemLabel}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.systemButton} onPress={handleHome}>
          <Text style={styles.systemIcon}>⌂</Text>
          <Text style={styles.systemLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.systemButton} onPress={handleMenu}>
          <Text style={styles.systemIcon}>☰</Text>
          <Text style={styles.systemLabel}>Menu</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          Tap an app to launch • Physical buttons 1-9 launch apps
        </Text>
        <Text style={styles.instructionsSubtext}>
          Configure apps in Settings → App Slots
        </Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e1e2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#cdd6f4',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#cdd6f4',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e1e2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 18,
  },
  warningBanner: {
    backgroundColor: '#f9e2af22',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f9e2af44',
  },
  warningText: {
    color: '#f9e2af',
    fontSize: 12,
    textAlign: 'center',
  },
  gridContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  appSlot: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#313244',
    position: 'relative',
  },
  appSlotDisabled: {
    opacity: 0.4,
  },
  appSlotSelected: {
    borderColor: '#89b4fa',
    backgroundColor: '#1e1e2e88',
  },
  appNumber: {
    position: 'absolute',
    top: 6,
    left: 8,
    fontSize: 10,
    color: '#6c7086',
    fontWeight: '600',
  },
  appIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  appName: {
    fontSize: 12,
    color: '#cdd6f4',
    fontWeight: '500',
    textAlign: 'center',
  },
  appNameDisabled: {
    color: '#6c7086',
  },
  systemRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#313244',
  },
  systemButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#313244',
  },
  systemIcon: {
    fontSize: 20,
    color: '#6c7086',
  },
  systemLabel: {
    fontSize: 10,
    color: '#6c7086',
    marginTop: 4,
  },
  instructions: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  instructionsText: {
    fontSize: 12,
    color: '#6c7086',
    textAlign: 'center',
  },
  instructionsSubtext: {
    fontSize: 11,
    color: '#45475a',
    textAlign: 'center',
    marginTop: 4,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1e1e2e',
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
  },
  appHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  appHeaderIcon: {
    fontSize: 18,
  },
  appHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cdd6f4',
  },
  homeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#313244',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIcon: {
    fontSize: 20,
    color: '#cdd6f4',
  },
});

