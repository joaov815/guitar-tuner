import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { colors } from './theme';

const BAR_HEIGHT = 30;

/** Microphone icon with a live input-level bar, so it's clear the tuner is listening. */
export default function MicLevel({ level, active }: { level: number; active: boolean }) {
  return (
    <View style={styles.row} accessibilityLabel={active ? 'Microphone on' : 'Microphone off'}>
      <Svg width={26} height={30} viewBox="0 0 26 30">
        <Rect x={8} y={2} width={10} height={17} rx={5} stroke={colors.muted} strokeWidth={2.2} fill="none" />
        <Path d="M4 14 a9 9 0 0 0 18 0" stroke={colors.muted} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <Line x1={13} y1={23} x2={13} y2={28} stroke={colors.muted} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
      <View style={styles.track}>
        <View style={[styles.fill, { height: Math.max(active ? 4 : 0, level * BAR_HEIGHT) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  track: {
    width: 8,
    height: BAR_HEIGHT,
    borderRadius: 4,
    backgroundColor: colors.faint,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', borderRadius: 4, backgroundColor: colors.meter },
});
