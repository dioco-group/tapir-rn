/**
 * HomeScreen - Main dashboard
 */

import React from 'react';
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ConnectionStatus } from '../components';
import { deviceStore, vaultStore } from '../stores';
import { RootStackParamList } from './index';

// ============================================================================
// Types
// ============================================================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// ============================================================================
// Quick Action Button
// ============================================================================

interface QuickActionProps {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}

const QuickAction: React.FC<QuickActionProps> = ({
  title,
  subtitle,
  icon,
  color,
  onPress,
  disabled,
}) => (
  <TouchableOpacity
    style={[styles.actionCard, disabled && styles.actionCardDisabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
  >
    <View style={[styles.actionIcon, { backgroundColor: color }]}>
      <Text style={styles.actionIconText}>{icon}</Text>
    </View>
    <Text style={styles.actionTitle}>{title}</Text>
    <Text style={styles.actionSubtitle}>{subtitle}</Text>
  </TouchableOpacity>
);

// ============================================================================
// Component
// ============================================================================

export const HomeScreen: React.FC = observer(() => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#11111b" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Tapir</Text>
          <Text style={styles.subtitle}>
            {deviceStore.isConnected
              ? 'Device connected'
              : 'Connect your device to get started'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Connection Status */}
        <ConnectionStatus onPress={() => navigation.navigate('Device')} />

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <QuickAction
            title="Launcher"
            subtitle="9 app slots"
            icon="🚀"
            color="#f38ba8"
            onPress={() => navigation.navigate('Launcher')}
          />
          <QuickAction
            title="Terminal"
            subtitle="32×18 display"
            icon="📺"
            color="#89b4fa"
            onPress={() => navigation.navigate('Terminal')}
            disabled={!deviceStore.isConnected}
          />
          <QuickAction
            title="LED Test"
            subtitle="12-key grid"
            icon="💡"
            color="#a6e3a1"
            onPress={() => navigation.navigate('LedTest')}
            disabled={!deviceStore.isConnected}
          />
          <QuickAction
            title="Mini-App"
            subtitle="WebView sandbox"
            icon="🌐"
            color="#f9e2af"
            onPress={() => navigation.navigate('MiniApp')}
          />
          <QuickAction
            title="Simulator"
            subtitle="Device preview"
            icon="📱"
            color="#cba6f7"
            onPress={() => navigation.navigate('Simulator')}
          />
        </View>

        {/* Device Stats (when connected) */}
        {deviceStore.isConnected && (
          <>
            <Text style={styles.sectionTitle}>Device Stats</Text>
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{deviceStore.mtu}</Text>
                <Text style={styles.statLabel}>MTU</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {deviceStore.batteryLevel ?? '—'}
                </Text>
                <Text style={styles.statLabel}>Battery %</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {deviceStore.rssi ?? '—'}
                </Text>
                <Text style={styles.statLabel}>RSSI</Text>
              </View>
            </View>
          </>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About Tapir Runtime</Text>
          <Text style={styles.infoText}>
            This app connects to your Tapir device via BLE and provides a
            sandboxed environment for Mini-Apps to control the display, LEDs,
            and access AI services.
          </Text>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '700',
    color: '#cdd6f4',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c7086',
    marginTop: 4,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e1e2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#cdd6f4',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  actionCard: {
    width: '46%',
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
    padding: 16,
    margin: '2%',
    borderWidth: 1,
    borderColor: '#313244',
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionIconText: {
    fontSize: 24,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cdd6f4',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6c7086',
    marginTop: 4,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#313244',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#cdd6f4',
  },
  statLabel: {
    fontSize: 12,
    color: '#6c7086',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#313244',
    marginHorizontal: 12,
  },
  infoCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#313244',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cdd6f4',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#a6adc8',
    lineHeight: 20,
  },
});

