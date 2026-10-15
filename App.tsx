import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import Gauge from './src/Gauge';
import { midiToFreq, noteName } from './src/music';
import { colors } from './src/theme';
import { CLOSE_CENTS, IN_TUNE_CENTS, useTuner } from './src/useTuner';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Tuner />
    </SafeAreaProvider>
  );
}

function Tuner() {
  const { status: tunerStatus, error, reading, held, start } = useTuner();

  const abs = reading ? Math.abs(reading.cents) : 0;
  const stateColor = !reading
    ? colors.muted
    : abs <= IN_TUNE_CENTS
      ? colors.ok
      : abs <= CLOSE_CENTS
        ? colors.warn
        : colors.bad;

  let status = tunerStatus === 'listening' ? 'Play a string' : tunerStatus === 'needs-tap' ? 'Tap to start listening' : ' ';
  if (reading) {
    const r = Math.round(reading.cents);
    status =
      abs <= IN_TUNE_CENTS
        ? 'In tune ✓'
        : `${r > 0 ? '+' : ''}${r} cents · ${reading.cents > 0 ? 'tune down ↓' : 'tune up ↑'}`;
  }

  const note = reading ? noteName(reading.midi) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.app}>
        <Text style={styles.title}>Guitar Tuner</Text>

        <View style={styles.panel}>
          <Gauge cents={reading ? reading.cents : null} color={stateColor} dimmed={held} />
          <View style={[styles.readout, held && styles.dimmed]}>
            <Text style={[styles.note, { color: reading ? stateColor : colors.text }]}>
              {note ? note.name : '–'}
              {note && <Text style={styles.octave}>{note.octave}</Text>}
            </Text>
            <Text style={styles.status}>{status}</Text>
            <Text style={styles.freq}>
              {reading ? `${reading.freq.toFixed(1)} Hz  ·  target ${midiToFreq(reading.midi).toFixed(1)} Hz` : ' '}
            </Text>
          </View>
        </View>

        {tunerStatus === 'needs-tap' && (
          <Pressable onPress={start} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryText}>Tap to start</Text>
          </Pressable>
        )}

        {error && (
          <Pressable style={styles.notice} onPress={start} accessibilityRole="button">
            <Text style={styles.noticeText}>{error}</Text>
            <Text style={[styles.noticeText, styles.retry]}>Tap to try again</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  app: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 16, gap: 20 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  readout: { alignItems: 'center', marginTop: 6 },
  dimmed: { opacity: 0.45 },
  note: { fontSize: 84, fontWeight: '700', lineHeight: 92, fontVariant: ['tabular-nums'] },
  octave: { fontSize: 28, fontWeight: '500', color: colors.muted },
  status: { color: colors.muted, fontSize: 18, marginTop: 8, minHeight: 24 },
  freq: { color: colors.muted, fontSize: 13, marginTop: 4, fontVariant: ['tabular-nums'] },
  primary: { backgroundColor: colors.accent, borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryText: { color: colors.accentText, fontSize: 17, fontWeight: '700' },
  notice: {
    backgroundColor: colors.noticeBg,
    borderColor: colors.noticeBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  noticeText: { color: colors.noticeText, fontSize: 14, lineHeight: 21 },
  retry: { fontWeight: '700', marginTop: 6 },
});
