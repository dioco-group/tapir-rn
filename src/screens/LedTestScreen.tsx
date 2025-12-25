/**
 * LedTestScreen - LED control testing
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import { bleService } from '../services';
import { deviceStore } from '../stores';

// ============================================================================
// LED Grid Configuration (3x4 = 12 LEDs)
// ============================================================================

const GRID_COLS = 3;
const GRID_ROWS = 4;

// Preset colors
const COLORS = [
  { name: 'Red', r: 255, g: 0, b: 0 },
  { name: 'Green', r: 0, g: 255, b: 0 },
  { name: 'Blue', r: 0, g: 0, b: 255 },
  { name: 'Yellow', r: 255, g: 255, b: 0 },
  { name: 'Cyan', r: 0, g: 255, b: 255 },
  { name: 'Magenta', r: 255, g: 0, b: 255 },
  { name: 'White', r: 255, g: 255, b: 255 },
  { name: 'Off', r: 0, g: 0, b: 0 },
];

// ============================================================================
// Component
// ============================================================================

export const LedTestScreen: React.FC = observer(() => {
  const navigation = useNavigation();
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [ledStates, setLedStates] = useState<Array<{ r: number; g: number; b: number }>>(
    new Array(GRID_COLS * GRID_ROWS).fill({ r: 0, g: 0, b: 0 })
  );

  const handleLedPress = async (index: number) => {
    if (!deviceStore.isConnected) return;

    try {
      await bleService.sendLedControl(
        index,
        selectedColor.r,
        selectedColor.g,
        selectedColor.b
      );

      // Update local state
      const newStates = [...ledStates];
      newStates[index] = { ...selectedColor };
      setLedStates(newStates);
    } catch (error) {
      console.error('LED control error:', error);
    }
  };

  const handleAllOn = async () => {
    if (!deviceStore.isConnected) return;

    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      await bleService.sendLedControl(i, selectedColor.r, selectedColor.g, selectedColor.b);
    }
    setLedStates(new Array(GRID_COLS * GRID_ROWS).fill({ ...selectedColor }));
  };

  const handleAllOff = async () => {
    if (!deviceStore.isConnected) return;

    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      await bleService.sendLedControl(i, 0, 0, 0);
    }
    setLedStates(new Array(GRID_COLS * GRID_ROWS).fill({ r: 0, g: 0, b: 0 }));
  };

  const renderLedButton = (index: number) => {
    const state = ledStates[index];
    const isOn = state.r > 0 || state.g > 0 || state.b > 0;
    const bgColor = isOn
      ? `rgb(${state.r}, ${state.g}, ${state.b})`
      : '#1e1e2e';

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.ledButton,
          { backgroundColor: bgColor },
          isOn && styles.ledButtonOn,
        ]}
        onPress={() => handleLedPress(index)}
        disabled={!deviceStore.isConnected}
      >
        <Text style={[styles.ledIndex, isOn && styles.ledIndexOn]}>
          {index}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#11111b" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>LED Test</Text>
        <View style={styles.placeholder} />
      </View>

      {/* LED Grid */}
      <View style={styles.gridContainer}>
        <Text style={styles.sectionTitle}>LED Grid (3×4)</Text>
        <View style={styles.grid}>
          {Array.from({ length: GRID_ROWS }, (_, row) => (
            <View key={row} style={styles.gridRow}>
              {Array.from({ length: GRID_COLS }, (_, col) => {
                const index = row * GRID_COLS + col;
                return renderLedButton(index);
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Color Palette */}
      <View style={styles.paletteContainer}>
        <Text style={styles.sectionTitle}>Select Color</Text>
        <View style={styles.palette}>
          {COLORS.map((color, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.colorButton,
                { backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` },
                selectedColor.name === color.name && styles.colorButtonSelected,
                color.name === 'Off' && styles.colorButtonOff,
              ]}
              onPress={() => setSelectedColor(color)}
            >
              {selectedColor.name === color.name && (
                <Text style={styles.colorCheck}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.selectedColorText}>
          Selected: {selectedColor.name}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSuccess]}
          onPress={handleAllOn}
          disabled={!deviceStore.isConnected}
        >
          <Text style={styles.actionButtonText}>All On</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={handleAllOff}
          disabled={!deviceStore.isConnected}
        >
          <Text style={styles.actionButtonText}>All Off</Text>
        </TouchableOpacity>
      </View>

      {/* Status */}
      {!deviceStore.isConnected && (
        <View style={styles.disconnectedBanner}>
          <Text style={styles.disconnectedText}>
            Connect to a device to control LEDs
          </Text>
        </View>
      )}
    </View>
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
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#cdd6f4',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#cdd6f4',
  },
  placeholder: {
    width: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c7086',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  gridContainer: {
    padding: 16,
    alignItems: 'center',
  },
  grid: {
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ledButton: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#313244',
  },
  ledButtonOn: {
    borderColor: '#cdd6f4',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  ledIndex: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6c7086',
  },
  ledIndexOn: {
    color: '#11111b',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  paletteContainer: {
    padding: 16,
    alignItems: 'center',
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonSelected: {
    borderColor: '#cdd6f4',
  },
  colorButtonOff: {
    borderColor: '#45475a',
  },
  colorCheck: {
    fontSize: 18,
    color: '#11111b',
    fontWeight: '700',
  },
  selectedColorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#a6adc8',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonSuccess: {
    backgroundColor: '#a6e3a1',
  },
  actionButtonDanger: {
    backgroundColor: '#f38ba8',
  },
  actionButtonText: {
    color: '#11111b',
    fontWeight: '600',
    fontSize: 14,
  },
  disconnectedBanner: {
    backgroundColor: '#f38ba8',
    padding: 16,
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  disconnectedText: {
    color: '#11111b',
    fontWeight: '600',
  },
});

