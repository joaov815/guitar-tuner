export type Tuning = {
  name: string;
  /** MIDI note numbers, low string → high string. */
  notes: number[];
  flats?: boolean;
};

export const TUNINGS: Tuning[] = [
  { name: 'Standard', notes: [40, 45, 50, 55, 59, 64] },
  { name: 'Drop D', notes: [38, 45, 50, 55, 59, 64] },
  { name: 'Half step down', notes: [39, 44, 49, 54, 58, 63], flats: true },
  { name: 'Full step down', notes: [38, 43, 48, 53, 57, 62] },
  { name: 'Drop C', notes: [36, 43, 48, 53, 57, 62] },
  { name: 'Open G', notes: [38, 43, 50, 55, 59, 62] },
  { name: 'Open D', notes: [38, 45, 50, 54, 57, 62] },
  { name: 'DADGAD', notes: [38, 45, 50, 55, 57, 62] },
];

const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export const midiToFreq = (midi: number, a4: number) => a4 * Math.pow(2, (midi - 69) / 12);
export const freqToMidi = (freq: number, a4: number) => 69 + 12 * Math.log2(freq / a4);
export const centsBetween = (freq: number, ref: number) => 1200 * Math.log2(freq / ref);

export function noteName(midi: number, flats?: boolean) {
  const m = Math.round(midi);
  return { name: (flats ? FLATS : SHARPS)[((m % 12) + 12) % 12], octave: Math.floor(m / 12) - 1 };
}

export function tuningLabel(t: Tuning) {
  return t.notes.map((m) => noteName(m, t.flats).name).join(' ');
}
