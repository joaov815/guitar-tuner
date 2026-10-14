import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { colors } from './theme';

const RANGE = 50; // cents shown on each side
const SWING = 80; // needle degrees for ±RANGE
const R = 140;
const IN_TUNE = 5;

const toDeg = (cents: number) => (Math.max(-RANGE, Math.min(RANGE, cents)) / RANGE) * SWING;
const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) };
};

const labelFont = Platform.select({ web: 'system-ui, -apple-system, sans-serif', default: undefined });

const ticks = Array.from({ length: (2 * RANGE) / 5 + 1 }, (_, i) => -RANGE + i * 5);
const ok = polar(toDeg(IN_TUNE), R);

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
    <View style={{ width: '100%', aspectRatio: 320 / 170 }}>
      <Svg viewBox="-160 -150 320 170" width="100%" height="100%">
        <Path d={`M -${R} 0 A ${R} ${R} 0 0 1 ${R} 0`} stroke={colors.line} strokeWidth={10} strokeLinecap="round" fill="none" />
        <Path
          d={`M ${-ok.x} ${ok.y} A ${R} ${R} 0 0 1 ${ok.x} ${ok.y}`}
          stroke={colors.ok}
          strokeWidth={10}
          opacity={0.35}
          fill="none"
        />
        {ticks.map((c) => {
          const major = c % 25 === 0;
          const deg = toDeg(c);
          const a = polar(deg, major ? 116 : 122);
          const b = polar(deg, 130);
          const label = polar(deg, 100);
          return (
            <G key={c}>
              <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={major ? colors.text : colors.muted} strokeWidth={major ? 3 : 2} />
              {major && (
                <SvgText x={label.x} y={label.y + 4} fill={colors.muted} fontSize={11} fontFamily={labelFont} textAnchor="middle">
                  {c > 0 ? `+${c}` : `${c}`}
                </SvgText>
              )}
            </G>
          );
        })}
        <G transform={`rotate(${toDeg(shown).toFixed(2)})`} opacity={dimmed ? 0.45 : 1}>
          <Line x1={0} y1={0} x2={0} y2={-128} stroke={color} strokeWidth={4} strokeLinecap="round" />
          <Circle r={7} fill={color} />
        </G>
      </Svg>
    </View>
  );
}
