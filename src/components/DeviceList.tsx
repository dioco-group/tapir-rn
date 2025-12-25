/**
 * DeviceList - Displays scanned BLE devices
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { deviceStore } from '../stores';
import { ScannedDevice } from '../types/protocol';

// ============================================================================
// Props
// ============================================================================

interface DeviceListProps {
  onDevicePress: (device: ScannedDevice) => void;
}

// ============================================================================
// Device Item
// ============================================================================

const DeviceItem: React.FC<{
  device: ScannedDevice;
  onPress: () => void;
}> = ({ device, onPress }) => {
  const signalStrength = device.rssi ?? -100;
  const signalBars = Math.max(0, Math.min(4, Math.floor((signalStrength + 100) / 20)));

  return (
    <TouchableOpacity style={styles.deviceItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>
          {device.name ?? device.localName ?? 'Unknown Device'}
        </Text>
        <Text style={styles.deviceId}>{device.id}</Text>
      </View>
      <View style={styles.signalContainer}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.signalBar,
              {
                height: 8 + i * 4,
                backgroundColor: i < signalBars ? '#22c55e' : '#45475a',
              },
            ]}
          />
        ))}
        <Text style={styles.rssi}>{signalStrength} dBm</Text>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================================
// Component
// ============================================================================

export const DeviceList: React.FC<DeviceListProps> = observer(({ onDevicePress }) => {
  const { scannedDevicesList, isScanning } = deviceStore;

  const handleScan = async () => {
    if (isScanning) {
      deviceStore.stopScan();
    } else {
      await deviceStore.startScan();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Devices</Text>
        <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
          {isScanning ? (
            <ActivityIndicator size="small" color="#cba6f7" />
          ) : (
            <Text style={styles.scanButtonText}>Scan</Text>
          )}
        </TouchableOpacity>
      </View>

      {scannedDevicesList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {isScanning
              ? 'Searching for Tapir devices...'
              : 'No devices found. Tap Scan to search.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={scannedDevicesList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DeviceItem device={item} onPress={() => onDevicePress(item)} />
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#cdd6f4',
  },
  scanButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#45475a',
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#cba6f7',
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e1e2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#313244',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#cdd6f4',
  },
  deviceId: {
    fontSize: 12,
    color: '#6c7086',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  signalBar: {
    width: 4,
    marginHorizontal: 1,
    borderRadius: 2,
  },
  rssi: {
    fontSize: 10,
    color: '#6c7086',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c7086',
    textAlign: 'center',
  },
});

