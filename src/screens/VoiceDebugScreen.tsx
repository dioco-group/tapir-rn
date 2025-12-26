/**
 * VoiceDebugScreen - Debug UI for PTT voice testing
 * 
 * Shows info about the last voice clip received from Tapir
 * and allows playback of the recorded audio.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { observer } from 'mobx-react-lite';
import { voiceService, VoiceState, VoiceClipInfo } from '../services/VoiceService';

const VoiceDebugScreen: React.FC = observer(() => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveDuration, setLiveDuration] = useState(0);

  const state = voiceService.state;
  const clipInfo = voiceService.lastClipInfo;
  const hasClip = voiceService.hasClip();
  const lastResult = voiceService.lastResult;

  // Live stats from VoiceService
  const livePacketCount = voiceService.livePacketCount;
  const liveBytesReceived = voiceService.liveBytesReceived;
  const liveSequenceGaps = voiceService.liveSequenceGaps;
  const liveRecordingStart = voiceService.liveRecordingStart;

  // Update live duration every 100ms while recording
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (state === 'listening' && liveRecordingStart > 0) {
      interval = setInterval(() => {
        setLiveDuration(Date.now() - liveRecordingStart);
      }, 100);
    } else {
      setLiveDuration(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state, liveRecordingStart]);

  const handlePlayClip = async () => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    setError(null);
    
    try {
      await voiceService.playLastClip();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPlaying(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (ms: number) => {
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getStateColor = (state: VoiceState) => {
    switch (state) {
      case 'idle': return '#888';
      case 'listening': return '#4CAF50';
      case 'processing': return '#FF9800';
      case 'speaking': return '#2196F3';
      default: return '#888';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Voice Debug</Text>

      {/* Current State */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current State</Text>
        <View style={styles.stateRow}>
          <View style={[styles.stateIndicator, { backgroundColor: getStateColor(state) }]} />
          <Text style={styles.stateText}>{state.toUpperCase()}</Text>
        </View>
        <Text style={styles.hint}>
          Press and hold KEY2 on Tapir to record
        </Text>
      </View>

      {/* Live Stats (shown while recording) */}
      {state === 'listening' && (
        <View style={[styles.section, styles.liveSection]}>
          <Text style={styles.sectionTitle}>📡 Live Stats</Text>
          <View style={styles.liveStatsGrid}>
            <View style={styles.liveStat}>
              <Text style={styles.liveStatValue}>{livePacketCount}</Text>
              <Text style={styles.liveStatLabel}>Packets</Text>
            </View>
            <View style={styles.liveStat}>
              <Text style={styles.liveStatValue}>{formatBytes(liveBytesReceived)}</Text>
              <Text style={styles.liveStatLabel}>Data</Text>
            </View>
            <View style={styles.liveStat}>
              <Text style={styles.liveStatValue}>{formatDuration(liveDuration)}</Text>
              <Text style={styles.liveStatLabel}>Duration</Text>
            </View>
            <View style={styles.liveStat}>
              <Text style={[styles.liveStatValue, liveSequenceGaps > 0 && styles.warnText]}>
                {liveSequenceGaps}
              </Text>
              <Text style={styles.liveStatLabel}>Gaps</Text>
            </View>
          </View>
          {livePacketCount > 0 && (
            <Text style={styles.liveRate}>
              ~{((liveBytesReceived / (liveDuration / 1000)) / 1000 * 8).toFixed(1)} kbps
            </Text>
          )}
        </View>
      )}

      {/* Last Clip Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last Clip</Text>
        
        {clipInfo ? (
          <View style={styles.infoGrid}>
            <InfoRow label="Recorded" value={formatTime(clipInfo.timestamp)} />
            <InfoRow label="Duration" value={formatDuration(clipInfo.duration)} />
            <InfoRow label="Packets" value={String(clipInfo.packetCount)} />
            <InfoRow label="Size" value={formatBytes(clipInfo.totalBytes)} />
            <InfoRow label="Seq Gaps" value={String(clipInfo.sequenceGaps)} warn={clipInfo.sequenceGaps > 0} />
            <InfoRow label="Sample Rate" value={`${clipInfo.sampleRate} Hz`} />
          </View>
        ) : (
          <Text style={styles.noData}>No clip recorded yet</Text>
        )}
      </View>

      {/* Playback */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Playback</Text>
        
        <TouchableOpacity
          style={[
            styles.playButton,
            !hasClip && styles.playButtonDisabled,
            isPlaying && styles.playButtonPlaying,
          ]}
          onPress={handlePlayClip}
          disabled={!hasClip || isPlaying}
        >
          <Text style={styles.playButtonText}>
            {isPlaying ? '▶ Playing...' : hasClip ? '▶ Play Last Clip' : '▶ No Clip'}
          </Text>
        </TouchableOpacity>

        {error && (
          <Text style={styles.error}>{error}</Text>
        )}
      </View>

      {/* Last Result */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last STT Result</Text>
        
        {lastResult ? (
          <>
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Transcript:</Text>
              <Text style={styles.resultText}>{lastResult.transcript}</Text>
            </View>
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>AI Response:</Text>
              <Text style={styles.resultText}>{lastResult.response}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.noData}>No transcription yet</Text>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How to Test</Text>
        <Text style={styles.instructions}>
          1. Connect to Tapir device via BLE{'\n'}
          2. Press and hold KEY2 (PTT button){'\n'}
          3. Speak into the device microphone{'\n'}
          4. Release KEY2{'\n'}
          5. View clip info and play back audio{'\n'}
          {'\n'}
          Note: The Opus decoder is currently a stub.{'\n'}
          Playback will be silent until real decoder is added.
        </Text>
      </View>
    </ScrollView>
  );
});

// Info row component
const InfoRow: React.FC<{ label: string; value: string; warn?: boolean }> = ({ label, value, warn }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, warn && styles.infoWarn]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 12,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stateIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  stateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  liveSection: {
    backgroundColor: '#1a3a1a',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  liveStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveStat: {
    alignItems: 'center',
    flex: 1,
  },
  liveStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    fontFamily: 'monospace',
  },
  liveStatLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  liveRate: {
    fontSize: 12,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 12,
    fontFamily: 'monospace',
  },
  warnText: {
    color: '#FF9800',
  },
  infoGrid: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
  },
  infoValue: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'monospace',
  },
  infoWarn: {
    color: '#FF9800',
  },
  noData: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  playButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  playButtonDisabled: {
    backgroundColor: '#444',
  },
  playButtonPlaying: {
    backgroundColor: '#2196F3',
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  error: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 8,
  },
  resultBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 14,
    color: '#fff',
  },
  instructions: {
    fontSize: 13,
    color: '#888',
    lineHeight: 20,
  },
});

export default VoiceDebugScreen;

