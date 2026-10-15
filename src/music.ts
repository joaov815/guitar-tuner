const A4 = 440;

/** Note names in the order shown on the note row (starting from A, like most tuners). */
export const NOTE_ROW = ['A', 'A♯', 'B', 'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯'];
const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export const midiToFreq = (midi: number) => A4 * Math.pow(2, (midi - 69) / 12);
export const freqToMidi = (freq: number) => 69 + 12 * Math.log2(freq / A4);
export const centsBetween = (freq: number, ref: number) => 1200 * Math.log2(freq / ref);

const pc = (midi: number) => ((Math.round(midi) % 12) + 12) % 12;

export function noteName(midi: number) {
  const m = Math.round(midi);
  return { name: SHARPS[pc(m)], octave: Math.floor(m / 12) - 1 };
}

/** Position of a MIDI note on NOTE_ROW (A = 0 … G♯ = 11). */
export const rowIndex = (midi: number) => (pc(midi) + 3) % 12;
