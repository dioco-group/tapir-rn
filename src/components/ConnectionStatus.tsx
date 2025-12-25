/**
 * ConnectionStatus - Displays device connection status
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { observer } from 'mobx-react-lite';
import { deviceStore } from '../stores';
import { ConnectionState } from '../types/protocol';

// ============================================================================
// Props
// ============================================================================

interface ConnectionStatusProps {
  onPress?: () => void;
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const ConnectionStatus: React.FC<ConnectionStatusProps> = observer(
  ({ onPress, compact = false }) => {
    const { connectionState, connectedDeviceName, mtu, statusText } = deviceStore;

    const getStatusColor = () => {
      switch (connectionState) {
        case ConnectionState.READY:
          return '#22c55e'; // green
        case ConnectionState.CONNECTED:
          return '#84cc16'; // lime
        case ConnectionState.CONNECTING:
        case ConnectionState.SCANNING:
          return '#f59e0b'; // amber
        default:
          return '#ef4444'; // red
      }
    };

    const isLoading =
      connectionState === ConnectionState.SCANNING ||
      connectionState === ConnectionState.CONNECTING;

    if (compact) {
      return (
        <TouchableOpacity
          style={styles.compactContainer}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.compactText}>
            {connectedDeviceName ?? statusText}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.row}>
          <View style={[styles.indicator, { backgroundColor: getStatusColor() }]}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.innerDot} />
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {connectedDeviceName ?? 'Tapir Device'}
            </Text>
            <Text style={styles.subtitle}>{statusText}</Text>
          </View>
        </View>
        {connectionState === ConnectionState.READY && (
          <View style={styles.statsRow}>
            <Text style={styles.stat}>MTU: {mtu}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }
);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#313244',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cdd6f4',
  },
  subtitle: {
    fontSize: 13,
    color: '#a6adc8',
    marginTop: 2,
  },
  compactText: {
    fontSize: 13,
    color: '#cdd6f4',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#313244',
  },
  stat: {
    fontSize: 12,
    color: '#6c7086',
    marginRight: 16,
  },
});

