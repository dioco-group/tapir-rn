/**
 * DeviceSimulator - Visual representation of the Tapir device
 * 
 * Shows:
 * - 3×4 button grid with LED colors
 * - 2 trigger buttons (back)
 * - 32×18 terminal display
 * - Interactive button presses
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { terminalStore, deviceStore } from '../stores';

// ============================================================================
// Types
// ============================================================================

interface DeviceSimulatorProps {
  /** Callback when a button is pressed */
  onButtonPress?: (index: number) => void;
  /** Callback when a button is released */
  onButtonRelease?: (index: number) => void;
  /** LED colors for each button (index 0-11) */
  ledColors?: { [key: number]: { r: number; g: number; b: number } };
  /** Scale factor (default 1.0) */
  scale?: number;
  /** Show trigger buttons */
  showTriggers?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEVICE_WIDTH = 120;
const DEVICE_BUTTON_AREA_HEIGHT = 160;
const DEVICE_DISPLAY_HEIGHT = 140;
const BUTTON_SIZE = 28;
const BUTTON_GAP = 8;
const TRIGGER_HEIGHT = 20;

const COLS = 32;
const ROWS = 18;

// ============================================================================
// Button Component
// ============================================================================

interface DeviceButtonProps {
  index: number;
  ledColor?: { r: number; g: number; b: number };
  onPressIn?: () => void;
  onPressOut?: () => void;
}

const DeviceButton: React.FC<DeviceButtonProps> = ({
  index,
  ledColor,
  onPressIn,
  onPressOut,
}) => {
  const hasLed = ledColor && (ledColor.r > 0 || ledColor.g > 0 || ledColor.b > 0);
  const glowColor = hasLed
    ? `rgba(${ledColor!.r}, ${ledColor!.g}, ${ledColor!.b}, 0.8)`
    : 'transparent';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        hasLed && { shadowColor: glowColor, shadowOpacity: 1, shadowRadius: 8 },
      ]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      {hasLed && (
        <View
          style={[
            styles.buttonLed,
            { backgroundColor: `rgb(${ledColor!.r}, ${ledColor!.g}, ${ledColor!.b})` },
          ]}
        />
      )}
      <Text style={styles.buttonIndex}>{index}</Text>
    </Pressable>
  );
};

// ============================================================================
// Trigger Button Component
// ============================================================================

interface TriggerButtonProps {
  label: string;
  index: number;
  onPressIn?: () => void;
  onPressOut?: () => void;
}

const TriggerButton: React.FC<TriggerButtonProps> = ({
  label,
  index,
  onPressIn,
  onPressOut,
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.trigger,
      pressed && styles.triggerPressed,
    ]}
    onPressIn={onPressIn}
    onPressOut={onPressOut}
  >
    <Text style={styles.triggerLabel}>{label}</Text>
  </Pressable>
);

// ============================================================================
// Terminal Display Component
// ============================================================================

const TerminalDisplay: React.FC = observer(() => {
  const buffer = terminalStore.bufferAsString;
  
  // Scale font to fit
  const fontSize = 5;
  const lineHeight = fontSize * 1.2;

  return (
    <View style={styles.display}>
      <View style={styles.displayInner}>
        <Text
          style={[
            styles.displayText,
            { fontSize, lineHeight },
          ]}
          numberOfLines={ROWS}
        >
          {buffer || ' '.repeat(COLS * ROWS)}
        </Text>
      </View>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const DeviceSimulator: React.FC<DeviceSimulatorProps> = observer(({
  onButtonPress,
  onButtonRelease,
  ledColors = {},
  scale = 1,
  showTriggers = true,
}) => {
  const handlePressIn = useCallback((index: number) => {
    onButtonPress?.(index);
  }, [onButtonPress]);

  const handlePressOut = useCallback((index: number) => {
    onButtonRelease?.(index);
  }, [onButtonRelease]);

  return (
    <View style={[styles.container, { transform: [{ scale }] }]}>
      {/* Device Body */}
      <View style={styles.deviceBody}>
        {/* Trigger Buttons (Back) */}
        {showTriggers && (
          <View style={styles.triggerRow}>
            <TriggerButton
              label="T1"
              index={12}
              onPressIn={() => handlePressIn(12)}
              onPressOut={() => handlePressOut(12)}
            />
            <TriggerButton
              label="T2"
              index={13}
              onPressIn={() => handlePressIn(13)}
              onPressOut={() => handlePressOut(13)}
            />
          </View>
        )}

        {/* Button Area */}
        <View style={styles.buttonArea}>
          {/* 4 rows × 3 cols */}
          {[0, 1, 2, 3].map((row) => (
            <View key={row} style={styles.buttonRow}>
              {[0, 1, 2].map((col) => {
                const index = row * 3 + col;
                return (
                  <DeviceButton
                    key={index}
                    index={index}
                    ledColor={ledColors[index]}
                    onPressIn={() => handlePressIn(index)}
                    onPressOut={() => handlePressOut(index)}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Display */}
        <TerminalDisplay />

        {/* USB-C Port */}
        <View style={styles.usbPort} />
      </View>

      {/* Connection Status */}
      <View style={styles.statusBar}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: deviceStore.isConnected ? '#a6e3a1' : '#f38ba8' },
          ]}
        />
        <Text style={styles.statusText}>
          {deviceStore.isConnected ? 'Connected' : 'Simulated'}
        </Text>
      </View>
    </View>
  );
});

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  deviceBody: {
    width: DEVICE_WIDTH,
    backgroundColor: '#4a4a52', // Gunmetal gray
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  triggerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  trigger: {
    backgroundColor: '#2a2a30',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3a3a42',
  },
  triggerPressed: {
    backgroundColor: '#5a5a62',
  },
  triggerLabel: {
    color: '#888',
    fontSize: 9,
    fontWeight: '600',
  },
  buttonArea: {
    backgroundColor: '#3a3a42',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: BUTTON_GAP,
    marginVertical: BUTTON_GAP / 2,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#1a1a1e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a30',
  },
  buttonPressed: {
    backgroundColor: '#3a3a42',
    transform: [{ scale: 0.95 }],
  },
  buttonLed: {
    position: 'absolute',
    width: BUTTON_SIZE - 8,
    height: BUTTON_SIZE - 8,
    borderRadius: (BUTTON_SIZE - 8) / 2,
    opacity: 0.8,
  },
  buttonIndex: {
    color: '#555',
    fontSize: 8,
    fontWeight: '600',
  },
  display: {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: 4,
    padding: 4,
    marginBottom: 8,
  },
  displayInner: {
    backgroundColor: '#0a0a0a',
    borderRadius: 2,
    padding: 2,
    minHeight: DEVICE_DISPLAY_HEIGHT - 16,
  },
  displayText: {
    fontFamily: 'monospace',
    color: '#33ff33',
    letterSpacing: -0.5,
  },
  usbPort: {
    width: 20,
    height: 6,
    backgroundColor: '#2a2a30',
    borderRadius: 2,
    marginTop: 4,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#888',
    fontSize: 10,
  },
});

