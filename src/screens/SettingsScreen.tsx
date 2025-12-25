/**
 * SettingsScreen - App settings and API key vault
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  StatusBar,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import { vaultStore, notificationStore, launcherStore } from '../stores';
import { storageService } from '../services';
import type { AppSlot } from '../stores/LauncherStore';

// ============================================================================
// Setting Row Component
// ============================================================================

interface SettingRowProps {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({
  title,
  subtitle,
  value,
  onPress,
  rightElement,
}) => (
  <TouchableOpacity
    style={styles.settingRow}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.settingTextContainer}>
      <Text style={styles.settingTitle}>{title}</Text>
      {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
    </View>
    {value && <Text style={styles.settingValue}>{value}</Text>}
    {rightElement}
  </TouchableOpacity>
);

// ============================================================================
// API Key Input Modal (inline)
// ============================================================================

interface ApiKeyInputProps {
  title: string;
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  title,
  value,
  placeholder,
  onSave,
  onCancel,
}) => {
  const [text, setText] = useState(value);

  return (
    <View style={styles.inputModal}>
      <Text style={styles.inputTitle}>{title}</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor="#6c7086"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <View style={styles.inputButtons}>
        <TouchableOpacity style={styles.inputButton} onPress={onCancel}>
          <Text style={styles.inputButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.inputButton, styles.inputButtonPrimary]}
          onPress={() => onSave(text)}
        >
          <Text style={[styles.inputButtonText, styles.inputButtonTextPrimary]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================================================
// Component
// ============================================================================

// ============================================================================
// App Slot Editor Modal
// ============================================================================

interface AppSlotEditorProps {
  slot: AppSlot;
  onSave: (updates: Partial<AppSlot>) => void;
  onCancel: () => void;
}

const AppSlotEditor: React.FC<AppSlotEditorProps> = ({ slot, onSave, onCancel }) => {
  const [name, setName] = useState(slot.name);
  const [icon, setIcon] = useState(slot.icon);
  const [url, setUrl] = useState(slot.url);
  const [enabled, setEnabled] = useState(slot.enabled);

  return (
    <View style={styles.inputModal}>
      <Text style={styles.inputTitle}>App Slot {slot.id + 1}</Text>
      
      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="App name"
        placeholderTextColor="#6c7086"
        maxLength={12}
      />
      
      <Text style={styles.fieldLabel}>Icon (emoji)</Text>
      <TextInput
        style={styles.input}
        value={icon}
        onChangeText={setIcon}
        placeholder="📱"
        placeholderTextColor="#6c7086"
        maxLength={4}
      />
      
      <Text style={styles.fieldLabel}>URL</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="http://192.168.1.57:8082/app.html"
        placeholderTextColor="#6c7086"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Enabled</Text>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: '#45475a', true: '#89b4fa' }}
          thumbColor="#cdd6f4"
        />
      </View>
      
      <View style={styles.inputButtons}>
        <TouchableOpacity style={styles.inputButton} onPress={onCancel}>
          <Text style={styles.inputButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.inputButton, styles.inputButtonPrimary]}
          onPress={() => onSave({ name, icon, url, enabled: enabled && url.length > 0 })}
        >
          <Text style={[styles.inputButtonText, styles.inputButtonTextPrimary]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================================================
// Component
// ============================================================================

export const SettingsScreen: React.FC = observer(() => {
  const navigation = useNavigation();
  const [editingKey, setEditingKey] = useState<'openai' | 'anthropic' | null>(null);
  const [editingAppSlot, setEditingAppSlot] = useState<number | null>(null);
  const [autoConnect, setAutoConnect] = useState(storageService.getAutoConnect());

  const handleAutoConnectChange = (value: boolean) => {
    setAutoConnect(value);
    storageService.setAutoConnect(value);
  };

  const handleSaveOpenAi = (key: string) => {
    vaultStore.setOpenAiKey(key);
    setEditingKey(null);
  };

  const handleSaveAnthropic = (key: string) => {
    vaultStore.setAnthropicKey(key);
    setEditingKey(null);
  };

  const handleClearAllKeys = () => {
    Alert.alert(
      'Clear All API Keys',
      'This will remove all saved API keys. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => vaultStore.clearAllKeys(),
        },
      ]
    );
  };

  const handleSaveAppSlot = (index: number, updates: Partial<AppSlot>) => {
    launcherStore.updateApp(index, updates);
    setEditingAppSlot(null);
  };

  const handleResetApps = () => {
    Alert.alert(
      'Reset App Slots',
      'This will reset all app slots to defaults. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => launcherStore.resetToDefaults(),
        },
      ]
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
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Device Identity */}
        <Text style={styles.sectionTitle}>Device Identity</Text>
        <View style={styles.section}>
          <SettingRow
            title="Device ID"
            subtitle="Used for cloud authentication"
            value={vaultStore.deviceId.substring(0, 8) + '...'}
          />
        </View>

        {/* Connection */}
        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.section}>
          <SettingRow
            title="Auto-Connect"
            subtitle="Reconnect to last device on launch"
            rightElement={
              <Switch
                value={autoConnect}
                onValueChange={handleAutoConnectChange}
                trackColor={{ false: '#45475a', true: '#89b4fa' }}
                thumbColor="#cdd6f4"
              />
            }
          />
        </View>

        {/* Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.section}>
          {notificationStore.isAvailable ? (
            <>
              <SettingRow
                title="Notification Access"
                subtitle={notificationStore.hasPermission 
                  ? 'Enabled - notifications will show on device' 
                  : 'Tap to enable notification forwarding'}
                value={notificationStore.hasPermission ? '✓' : ''}
                onPress={() => notificationStore.requestPermission()}
              />
              {notificationStore.hasPermission && (
                <SettingRow
                  title="Recent Notifications"
                  subtitle={`${notificationStore.notificationCount} notifications received`}
                />
              )}
            </>
          ) : (
            <SettingRow
              title="Notification Access"
              subtitle="Rebuild app to enable (eas build)"
              value="⚠️"
            />
          )}
        </View>

        {/* App Slots */}
        <Text style={styles.sectionTitle}>App Slots (Launcher)</Text>
        <View style={styles.section}>
          {editingAppSlot !== null ? (
            <AppSlotEditor
              slot={launcherStore.apps[editingAppSlot]}
              onSave={(updates) => handleSaveAppSlot(editingAppSlot, updates)}
              onCancel={() => setEditingAppSlot(null)}
            />
          ) : (
            <>
              {launcherStore.apps.map((app, idx) => (
                <SettingRow
                  key={app.id}
                  title={`${idx + 1}. ${app.icon} ${app.name}`}
                  subtitle={app.enabled ? app.url.substring(0, 35) + (app.url.length > 35 ? '...' : '') : 'Not configured'}
                  value={app.enabled ? '✓' : ''}
                  onPress={() => setEditingAppSlot(idx)}
                />
              ))}
              <TouchableOpacity style={styles.clearButton} onPress={handleResetApps}>
                <Text style={styles.clearButtonText}>Reset to Defaults</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* API Keys Vault */}
        <Text style={styles.sectionTitle}>API Keys Vault</Text>
        <View style={styles.section}>
          {editingKey === 'openai' ? (
            <ApiKeyInput
              title="OpenAI API Key"
              value=""
              placeholder="sk-..."
              onSave={handleSaveOpenAi}
              onCancel={() => setEditingKey(null)}
            />
          ) : (
            <SettingRow
              title="OpenAI"
              subtitle={vaultStore.hasOpenAiKey ? 'Key configured' : 'Not configured'}
              value={vaultStore.hasOpenAiKey ? '✓' : ''}
              onPress={() => setEditingKey('openai')}
            />
          )}

          {editingKey === 'anthropic' ? (
            <ApiKeyInput
              title="Anthropic API Key"
              value=""
              placeholder="sk-ant-..."
              onSave={handleSaveAnthropic}
              onCancel={() => setEditingKey(null)}
            />
          ) : (
            <SettingRow
              title="Anthropic"
              subtitle={vaultStore.hasAnthropicKey ? 'Key configured' : 'Not configured'}
              value={vaultStore.hasAnthropicKey ? '✓' : ''}
              onPress={() => setEditingKey('anthropic')}
            />
          )}

          {vaultStore.hasAnyApiKey && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearAllKeys}
            >
              <Text style={styles.clearButtonText}>Clear All Keys</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🔐 API Key Security</Text>
          <Text style={styles.infoText}>
            API keys are stored encrypted on your device using MMKV. They are never
            sent to any server except the respective API providers (OpenAI, Anthropic).
            Mini-Apps cannot access your keys directly - they can only request actions
            through the native proxy.
          </Text>
        </View>

        {/* Version Info */}
        <Text style={styles.versionText}>Tapir Runtime v1.0.0</Text>
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
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c7086',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  section: {
    backgroundColor: '#1e1e2e',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#313244',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#cdd6f4',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#6c7086',
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    color: '#a6e3a1',
    marginLeft: 12,
  },
  inputModal: {
    padding: 16,
  },
  inputTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cdd6f4',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#313244',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#cdd6f4',
    fontFamily: 'monospace',
  },
  inputButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#6c7086',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  switchLabel: {
    fontSize: 14,
    color: '#cdd6f4',
  },
  inputButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#45475a',
  },
  inputButtonPrimary: {
    backgroundColor: '#89b4fa',
  },
  inputButtonText: {
    color: '#cdd6f4',
    fontWeight: '600',
  },
  inputButtonTextPrimary: {
    color: '#11111b',
  },
  clearButton: {
    padding: 16,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#f38ba8',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#313244',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cdd6f4',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#a6adc8',
    lineHeight: 18,
  },
  versionText: {
    textAlign: 'center',
    color: '#6c7086',
    fontSize: 12,
    marginVertical: 32,
  },
});

