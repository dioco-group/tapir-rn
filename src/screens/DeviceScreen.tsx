/**
 * DeviceScreen - Device scanning and connection management
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import { ConnectionStatus, DeviceList } from '../components';
import { deviceStore } from '../stores';
import { ScannedDevice } from '../types/protocol';

// ============================================================================
// Component
// ============================================================================

export const DeviceScreen: React.FC = observer(() => {
  const navigation = useNavigation();

  const handleDevicePress = useCallback(async (device: ScannedDevice) => {
    Alert.alert(
      'Connect to Device',
      `Connect to ${device.name ?? device.id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: async () => {
            try {
              await deviceStore.connect(device.id);
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                'Connection Failed',
                error instanceof Error ? error.message : 'Unknown error'
              );
            }
          },
        },
      ]
    );
  }, [navigation]);

  const handleDisconnect = useCallback(async () => {
    Alert.alert('Disconnect', 'Disconnect from device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => deviceStore.disconnect(),
      },
    ]);
  }, []);

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
        <Text style={styles.title}>Device</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Current Connection */}
      {deviceStore.isConnected && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Device</Text>
          <ConnectionStatus />
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={handleDisconnect}
          >
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error Message */}
      {deviceStore.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{deviceStore.error}</Text>
        </View>
      )}

      {/* Device List */}
      <View style={styles.section}>
        <DeviceList onDevicePress={handleDevicePress} />
      </View>
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
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c7086',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  disconnectButton: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: '#45475a',
    borderRadius: 8,
    alignItems: 'center',
  },
  disconnectText: {
    color: '#f38ba8',
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#f38ba8',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#11111b',
    fontSize: 14,
  },
});

