/**
 * Tapir Runtime - React Native App Entry Point
 * 
 * A sandboxed runtime for Tapir device Mini-Apps.
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, LogBox } from 'react-native';

import {
  HomeScreen,
  DeviceScreen,
  SettingsScreen,
  TerminalScreen,
  LedTestScreen,
  MiniAppScreen,
  LauncherScreen,
  SimulatorScreen,
  VoiceDebugScreen,
  RootStackParamList,
} from './src/screens';
import { deviceStore, vaultStore } from './src/stores';

// Ignore specific warnings in development
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

// ============================================================================
// Navigation Stack
// ============================================================================

const Stack = createNativeStackNavigator<RootStackParamList>();

// ============================================================================
// App Component
// ============================================================================

export default function App() {
  // Initialize stores on mount
  useEffect(() => {
    // Ensure vault is loaded
    if (!vaultStore.isLoaded) {
      vaultStore.load();
    }

    // Try auto-connect
    deviceStore.autoConnect();

    // Cleanup on unmount
    return () => {
      deviceStore.disconnect();
    };
  }, []);

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#11111b" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#11111b' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Device" component={DeviceScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Terminal" component={TerminalScreen} />
        <Stack.Screen name="LedTest" component={LedTestScreen} />
        <Stack.Screen name="MiniApp" component={MiniAppScreen} />
        <Stack.Screen name="Launcher" component={LauncherScreen} />
        <Stack.Screen name="Simulator" component={SimulatorScreen} />
        <Stack.Screen name="VoiceDebug" component={VoiceDebugScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
