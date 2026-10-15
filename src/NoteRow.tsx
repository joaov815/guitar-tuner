import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { NOTE_ROW, rowIndex } from './music';
import { colors } from './theme';
import type { Reading } from './useTuner';

const MARKER_WIDTH = 6;

type Props = { reading: Reading | null; color: string; dimmed: boolean };

/** All twelve notes with the closest one highlighted and a marker showing how far off it is. */
export default function NoteRow({ reading, color, dimmed }: Props) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const active = reading ? rowIndex(reading.midi) : -1;

  // Centre of the note's column, nudged toward the neighbour by the cents offset (±50 = half a column).
  const position = reading ? rowIndex(reading.midi) + 0.5 + reading.cents / 100 : null;

  useEffect(() => {
    if (position === null || !width) return;
    Animated.timing(x, {
      toValue: (position * width) / NOTE_ROW.length - MARKER_WIDTH / 2,
      duration: 120,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [position, width, x]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel="Notes">
      <View style={styles.row}>
        {NOTE_ROW.map((name, i) => (
          <Text key={name} style={[styles.note, i === active && styles.active]}>
            {name}
          </Text>
        ))}
      </View>
      <View style={styles.track}>
        {reading && width > 0 && (
          <Animated.View
            style={[styles.marker, { backgroundColor: color, opacity: dimmed ? 0.45 : 1, transform: [{ translateX: x }] }]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  note: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 17 },
  active: { color: colors.text, fontWeight: '600' },
  track: { height: 22, marginTop: 8 },
  marker: { position: 'absolute', width: MARKER_WIDTH, height: 18, borderRadius: 3 },
});
