import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { playTone } from './src/audio';
import Gauge from './src/Gauge';
import { midiToFreq, noteName, TUNINGS, tuningLabel } from './src/music';
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
  const [tuningIndex, setTuningIndex] = useState(0);
  const [a4, setA4] = useState(440);
  const [auto, setAuto] = useState(true);
  const [selected, setSelected] = useState(0);
  const [toneOn, setToneOn] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const tuning = TUNINGS[tuningIndex];
  const { status: tunerStatus, error, reading, held, tuned, start } = useTuner({ tuning, a4, auto, selected });

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
        : abs > 100
          ? reading.cents > 0 ? 'Way too high ↓' : 'Way too low ↑'
          : `${r > 0 ? '+' : ''}${r} cents · ${reading.cents > 0 ? 'tune down ↓' : 'tune up ↑'}`;
  }

  const note = reading ? noteName(reading.targetMidi, tuning.flats) : null;
  const activeString = reading ? reading.stringIndex : auto ? -1 : selected;

  const onStringPress = (i: number) => {
    setSelected(i);
    setAuto(false);
    if (toneOn) playTone(midiToFreq(tuning.notes[i], a4));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.app}>
        <View style={styles.header}>
          <Text style={styles.title}>Guitar Tuner</Text>
          <Pressable style={styles.picker} onPress={() => setPickerOpen(true)} accessibilityRole="button">
            <Text style={styles.pickerText}>{tuning.name} ▾</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Gauge cents={reading ? reading.cents : null} color={stateColor} dimmed={held} />
          <View style={[styles.readout, held && styles.dimmed]}>
            <Text style={[styles.note, { color: reading ? stateColor : colors.text }]}>
              {note ? note.name : '–'}
              {note && <Text style={styles.octave}>{note.octave}</Text>}
            </Text>
            <Text style={styles.status}>{status}</Text>
            <Text style={styles.freq}>
              {reading
                ? `${reading.freq.toFixed(1)} Hz  ·  target ${midiToFreq(reading.targetMidi, a4).toFixed(1)} Hz`
                : ' '}
            </Text>
          </View>
        </View>

        <View style={styles.strings}>
          {tuning.notes.map((midi, i) => (
            <Pressable
              key={i}
              onPress={() => onStringPress(i)}
              style={[styles.string, i === activeString && styles.stringActive]}
              accessibilityLabel={`String ${6 - i}, ${noteName(midi, tuning.flats).name}`}
            >
              <Text style={[styles.stringNote, tuned.includes(i) && { color: colors.ok }]}>
                {noteName(midi, tuning.flats).name}
              </Text>
              <Text style={styles.stringNum}>{6 - i}</Text>
            </Pressable>
          ))}
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

        <View style={styles.row}>
          <Toggle label="Auto-detect string" value={auto} onChange={setAuto} />
          <Toggle label="Reference tone" value={toneOn} onChange={setToneOn} />
        </View>

        <View style={styles.row}>
          <Text style={styles.muted}>A4 =</Text>
          <Pressable style={styles.small} onPress={() => setA4((v) => Math.max(415, v - 1))} accessibilityLabel="Lower reference">
            <Text style={styles.smallText}>−</Text>
          </Pressable>
          <Text style={styles.a4}>{a4}</Text>
          <Text style={styles.muted}>Hz</Text>
          <Pressable style={styles.small} onPress={() => setA4((v) => Math.min(466, v + 1))} accessibilityLabel="Raise reference">
            <Text style={styles.smallText}>+</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Tuning</Text>
            {TUNINGS.map((t, i) => (
              <Pressable
                key={t.name}
                style={[styles.option, i === tuningIndex && styles.optionActive]}
                onPress={() => {
                  setTuningIndex(i);
                  setSelected((s) => Math.min(s, t.notes.length - 1));
                  setPickerOpen(false);
                }}
              >
                <Text style={styles.optionName}>{t.name}</Text>
                <Text style={styles.optionNotes}>{tuningLabel(t)}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.line }}
        thumbColor={colors.text}
      />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  app: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 16, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  picker: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pickerText: { color: colors.text, fontSize: 14 },
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
  strings: { flexDirection: 'row', gap: 8 },
  string: {
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  stringActive: { borderColor: colors.accent, backgroundColor: colors.panelActive },
  stringNote: { color: colors.text, fontSize: 18, fontWeight: '600' },
  stringNum: { color: colors.muted, fontSize: 11, marginTop: 2 },
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muted: { color: colors.muted, fontSize: 14 },
  a4: { color: colors.text, fontWeight: '700', minWidth: 36, textAlign: 'center', fontVariant: ['tabular-nums'] },
  small: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallText: { color: colors.text, fontSize: 18 },
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 24 },
  sheet: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 8,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sheetTitle: { color: colors.muted, fontSize: 13, padding: 12, paddingBottom: 4 },
  option: { padding: 12, borderRadius: 10 },
  optionActive: { backgroundColor: colors.panelActive },
  optionName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  optionNotes: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
