import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Gauge from './src/Gauge';
import MicLevel from './src/MicLevel';
import NoteRow from './src/NoteRow';
import { noteName } from './src/music';
import { screenCornerRadius } from './src/screenCorners';
import { useKeepAwakeWhile } from './src/useKeepAwakeWhile';
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
  const { status, error, reading, held, level, start } = useTuner();
  const cornerRadius = screenCornerRadius(useSafeAreaInsets().bottom);
  // Don't let the screen lock while a string is being played; quiet hands it back to Auto-Lock.
  useKeepAwakeWhile(reading !== null);

  const abs = reading ? Math.abs(reading.cents) : 0;
  const inTune = !!reading && !held && abs <= IN_TUNE_CENTS;
  const stateColor = !reading ? colors.needleIdle : abs <= IN_TUNE_CENTS ? colors.ok : abs <= CLOSE_CENTS ? colors.warn : colors.bad;

  const note = reading ? noteName(reading.midi) : null;
  const caption = reading
    ? `${reading.freq.toFixed(1)} Hz`
    : status === 'needs-tap'
      ? 'Tap to start listening'
      : status === 'listening'
        ? 'Play a string'
        : ' ';

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.app} onPress={status === 'needs-tap' ? start : undefined} accessible={false}>
        <View style={styles.top}>
          <MicLevel level={level} active={status === 'listening'} />
        </View>

        <View style={[styles.readout, held && styles.dimmed]}>
          <Text style={[styles.note, { color: reading ? stateColor : colors.faint }]}>
            {note ? note.name : '–'}
            {note && <Text style={styles.octave}>{note.octave}</Text>}
          </Text>
          <Text style={styles.caption}>{caption}</Text>
        </View>

        {error && (
          <Pressable style={styles.notice} onPress={start} accessibilityRole="button">
            <Text style={styles.noticeText}>{error}</Text>
            <Text style={[styles.noticeText, styles.retry]}>Tap to try again</Text>
          </Pressable>
        )}

        <Gauge cents={reading ? reading.cents : null} color={stateColor} dimmed={held} />

        <NoteRow reading={reading} color={stateColor} dimmed={held} />
      </Pressable>

      {/* Green frame while the note is in tune, following the screen's rounded corners. */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.frame, { borderRadius: cornerRadius }, inTune && styles.frameOn]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  app: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 24 },
  top: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  readout: { alignItems: 'center', marginTop: 8 },
  dimmed: { opacity: 0.45 },
  note: { fontSize: 112, fontWeight: '500', lineHeight: 124, fontVariant: ['tabular-nums'] },
  octave: { fontSize: 32, fontWeight: '400' },
  caption: { color: colors.text, fontSize: 20, marginTop: 2, minHeight: 26, fontVariant: ['tabular-nums'] },
  notice: {
    backgroundColor: colors.noticeBg,
    borderColor: colors.noticeBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  noticeText: { color: colors.noticeText, fontSize: 14, lineHeight: 21 },
  retry: { fontWeight: '700', marginTop: 6 },
  frame: { borderWidth: 6, borderColor: 'transparent' },
  frameOn: { borderColor: colors.ok },
});
