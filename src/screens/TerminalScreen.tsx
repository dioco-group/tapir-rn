/**
 * TerminalScreen - Terminal demo and testing
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import { terminalStore, deviceStore } from '../stores';

// ============================================================================
// Component
// ============================================================================

export const TerminalScreen: React.FC = observer(() => {
  const navigation = useNavigation();
  const animationRef = useRef<number | null>(null);
  const frameRef = useRef(0);

  // Demo animation effect
  const startMatrixDemo = () => {
    const cols = terminalStore.cols;
    const rows = terminalStore.rows;
    const chars = '0123456789ABCDEF';
    const drops: number[] = new Array(cols).fill(0);

    const animate = () => {
      frameRef.current++;

      // Clear buffer
      terminalStore.buffer.fill(0x20);

      // Draw falling characters
      for (let x = 0; x < cols; x++) {
        const y = drops[x];
        if (y < rows) {
          const char = chars[Math.floor(Math.random() * chars.length)];
          terminalStore.setChar(x, y, char);
        }

        // Move drop down
        if (y > rows || Math.random() > 0.95) {
          drops[x] = 0;
        } else {
          drops[x]++;
        }
      }

      // Flush to device
      terminalStore.flush();

      // Continue animation
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  const stopAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAnimation();
  }, []);

  const handleTestPattern = () => {
    terminalStore.fillTestPattern();
    terminalStore.flush();
  };

  const handleDrawBox = () => {
    terminalStore.clear();
    terminalStore.drawBox(0, 0, 32, 18, '[ TAPIR ]');
    terminalStore.writeText(2, 4, 'Welcome to Tapir Terminal!');
    terminalStore.writeText(2, 6, '32x18 character display');
    terminalStore.writeText(2, 8, `MTU: ${deviceStore.mtu}`);
    terminalStore.writeText(2, 10, `FPS: ${terminalStore.fps}`);
    terminalStore.flush();
  };

  const handleClear = async () => {
    stopAnimation();
    await terminalStore.clearDevice();
  };

  const handleMatrixStart = () => {
    stopAnimation();
    startMatrixDemo();
  };

  const handleMatrixStop = () => {
    stopAnimation();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#11111b" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            stopAnimation();
            navigation.goBack();
          }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Terminal</Text>
        <View style={styles.fpsContainer}>
          <Text style={styles.fpsText}>{terminalStore.fps} FPS</Text>
        </View>
      </View>

      {/* Terminal Preview */}
      <View style={styles.terminalContainer}>
        <View style={styles.terminalFrame}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.terminalText}>
              {terminalStore.bufferAsString}
            </Text>
          </ScrollView>
        </View>
        <Text style={styles.terminalInfo}>
          {terminalStore.cols}×{terminalStore.rows} = {terminalStore.screenSize} chars
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Text style={styles.sectionTitle}>Demo Patterns</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleTestPattern}
            disabled={!deviceStore.isConnected}
          >
            <Text style={styles.buttonText}>Grid Pattern</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.button}
            onPress={handleDrawBox}
            disabled={!deviceStore.isConnected}
          >
            <Text style={styles.buttonText}>Box Demo</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Matrix Animation</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSuccess]}
            onPress={handleMatrixStart}
            disabled={!deviceStore.isConnected}
          >
            <Text style={styles.buttonText}>▶ Start</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={handleMatrixStop}
          >
            <Text style={styles.buttonText}>■ Stop</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonWide]}
          onPress={handleClear}
          disabled={!deviceStore.isConnected}
        >
          <Text style={styles.buttonText}>Clear Screen</Text>
        </TouchableOpacity>
      </View>

      {/* Status */}
      {!deviceStore.isConnected && (
        <View style={styles.disconnectedBanner}>
          <Text style={styles.disconnectedText}>
            Connect to a device to test terminal output
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
  fpsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#a6e3a1',
    borderRadius: 12,
  },
  fpsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#11111b',
  },
  terminalContainer: {
    padding: 16,
  },
  terminalFrame: {
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: '#45475a',
  },
  terminalText: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 12,
    color: '#a6e3a1',
    letterSpacing: 0,
  },
  terminalInfo: {
    fontSize: 12,
    color: '#6c7086',
    textAlign: 'center',
    marginTop: 8,
  },
  controls: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c7086',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#45475a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonWide: {
    marginTop: 8,
  },
  buttonSuccess: {
    backgroundColor: '#a6e3a1',
  },
  buttonDanger: {
    backgroundColor: '#f38ba8',
  },
  buttonText: {
    color: '#cdd6f4',
    fontWeight: '600',
    fontSize: 14,
  },
  disconnectedBanner: {
    backgroundColor: '#f38ba8',
    padding: 16,
    alignItems: 'center',
  },
  disconnectedText: {
    color: '#11111b',
    fontWeight: '600',
  },
});

