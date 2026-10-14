// Reference tone: a triangle wave plus a soft octave, with a plucked-string style decay.
// Written against the Web Audio API shape, which react-native-audio-api mirrors on the phone.

type ParamLike = {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
};
type NodeLike = { connect(dest: any): unknown };
export type ToneContext = {
  currentTime: number;
  destination: any;
  createGain(): NodeLike & { gain: ParamLike };
  createOscillator(): NodeLike & {
    type: any;
    frequency: ParamLike;
    start(when?: number): void;
    stop(when?: number): void;
  };
};

export function playToneOn(ctx: ToneContext, freq: number) {
  const t0 = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.5);
  out.connect(ctx.destination);

  const partials: [number, 'triangle' | 'sine', number][] = [
    [1, 'triangle', 1],
    [2, 'sine', 0.3],
  ];
  for (const [mult, type, level] of partials) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq * mult;
    g.gain.value = level;
    osc.connect(g);
    g.connect(out);
    osc.start(t0);
    osc.stop(t0 + 2.6);
  }
}
