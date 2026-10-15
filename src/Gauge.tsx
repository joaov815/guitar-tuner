import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { colors } from './theme';

const RANGE = 50; // cents shown on each side
const SWING = 30; // needle degrees for ±RANGE
const NEEDLE = 300; // needle length; the pivot sits at (0, 0)
const IN_TUNE = 5;

const toDeg = (cents: number) => (Math.max(-RANGE, Math.min(RANGE, cents)) / RANGE) * SWING;
const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) };
};

const labelFont = Platform.select({ web: 'system-ui, -apple-system, sans-serif', default: undefined });

// Two close lines mark the in-tune window; the others mark ±25 and ±50 cents.
const ticks = [
  { deg: -toDeg(IN_TUNE), r0: 296 },
  { deg: toDeg(IN_TUNE), r0: 296 },
  { deg: toDeg(-25), r0: 300 },
  { deg: toDeg(25), r0: 300 },
  { deg: toDeg(-RANGE), r0: 296 },
  { deg: toDeg(RANGE), r0: 296 },
];
const flat = polar(toDeg(-RANGE) - 6, 300);
const sharp = polar(toDeg(RANGE) + 6, 300);

type Props = { cents: number | null; color: string; dimmed: boolean };

export default function Gauge({ cents, color, dimmed }: Props) {
  const target = cents ?? 0;
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);

  // Ease the needle toward its target for smooth motion between readings.
  useEffect(() => {
    let frame = 0;
    const step = () => {
      const next = shownRef.current + (target - shownRef.current) * 0.25;
      shownRef.current = Math.abs(target - next) < 0.05 ? target : next;
      setShown(shownRef.current);
      if (shownRef.current !== target) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <View style={{ flex: 1, minHeight: 180 }}>
      <Svg viewBox="-190 -335 380 365" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {ticks.map(({ deg, r0 }, i) => {
          const a = polar(deg, r0);
          const b = polar(deg, 330);
          return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colors.muted} strokeWidth={2.5} strokeLinecap="round" />;
        })}
        <SvgText x={flat.x} y={flat.y + 10} fill={colors.muted} fontSize={30} fontFamily={labelFont} textAnchor="middle">
          ♭
        </SvgText>
        <SvgText x={sharp.x} y={sharp.y + 10} fill={colors.muted} fontSize={30} fontFamily={labelFont} textAnchor="middle">
          ♯
        </SvgText>

        <G transform={`rotate(${toDeg(shown).toFixed(2)})`} opacity={dimmed ? 0.45 : 1}>
          <Line x1={0} y1={0} x2={0} y2={-NEEDLE} stroke={color} strokeWidth={3.5} strokeLinecap="round" />
        </G>
        <Circle r={24} stroke={colors.faint} strokeWidth={2} fill="none" />
        <Circle r={5} fill={colors.muted} />
      </Svg>
    </View>
  );
}
