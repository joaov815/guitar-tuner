import { useCallback, useEffect, useRef, useState } from 'react';

import { startMicrophone, type MicHandle } from './audio';
import { centsBetween, freqToMidi, midiToFreq, type Tuning } from './music';
import { detectPitch, MAX_FREQ, MIN_FREQ } from './pitch';

const ATTACK_RMS = 0.006; // loudness needed to lock onto a new note
const SUSTAIN_RMS = 0.0012; // keep tracking a locked note down to this level
const ATTACK_CLARITY = 0.85;
const SUSTAIN_CLARITY = 0.6;
const HOLD_MS = 3000; // keep the last reading on screen this long after the signal fades
const DIM_AFTER_MS = 250;
const ANALYSIS_INTERVAL_MS = 40; // ~25 pitch estimates per second
const IN_TUNE_HOLD_MS = 500; // in tune this long → mark the string as tuned
export const IN_TUNE_CENTS = 5;
export const CLOSE_CENTS = 15;

export type Reading = {
  freq: number;
  targetMidi: number;
  /** Index into tuning.notes, or -1 for a chromatic (non-string) note. */
  stringIndex: number;
  cents: number;
};

type Options = { tuning: Tuning; a4: number; auto: boolean; selected: number };

const median = (arr: number[]) => [...arr].sort((x, y) => x - y)[Math.floor(arr.length / 2)];

export function useTuner(options: Options) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [held, setHeld] = useState(false);
  const [tuned, setTuned] = useState<number[]>([]);

  const opts = useRef(options);
  opts.current = options;
  const mic = useRef<MicHandle | null>(null);
  const history = useRef<number[]>([]);
  const lastHeard = useRef(0);
  const lastAnalysis = useRef(0);
  const inTuneSince = useRef(0);

  const resetReading = useCallback(() => {
    history.current = [];
    inTuneSince.current = 0;
    setReading(null);
    setHeld(false);
  }, []);

  // Changing tuning or reference pitch invalidates which strings are in tune.
  useEffect(() => setTuned([]), [options.tuning, options.a4]);
  useEffect(resetReading, [options.tuning, options.auto, options.selected, resetReading]);

  const toReading = (freq: number): Reading => {
    const { tuning, a4, auto, selected } = opts.current;
    let stringIndex = -1;
    let targetMidi: number;
    if (auto) {
      let bestDiff = Infinity;
      tuning.notes.forEach((m, i) => {
        const d = Math.abs(centsBetween(freq, midiToFreq(m, a4)));
        if (d < bestDiff) {
          bestDiff = d;
          stringIndex = i;
        }
      });
      if (bestDiff <= 100) targetMidi = tuning.notes[stringIndex];
      else {
        stringIndex = -1; // nowhere near a string: show the nearest chromatic note
        targetMidi = Math.round(freqToMidi(freq, a4));
      }
    } else {
      stringIndex = selected;
      targetMidi = tuning.notes[selected];
    }
    return { freq, targetMidi, stringIndex, cents: centsBetween(freq, midiToFreq(targetMidi, a4)) };
  };

  const onWindow = (samples: Float32Array, sampleRate: number) => {
    const now = Date.now();
    if (now - lastAnalysis.current < ANALYSIS_INTERVAL_MS) return;
    lastAnalysis.current = now;

    const result = detectPitch(samples, sampleRate);
    const h = history.current;
    const valid = result && result.freq >= MIN_FREQ && result.freq <= MAX_FREQ;
    // A fresh pluck must be loud and clean to start tracking...
    const attack = valid && result.rms >= ATTACK_RMS && result.clarity > ATTACK_CLARITY;
    // ...but once a note is locked, keep following it as it rings out quieter,
    // as long as it stays within a semitone of what we're tracking.
    const sustain =
      valid && h.length > 0 && result.rms >= SUSTAIN_RMS && result.clarity > SUSTAIN_CLARITY &&
      Math.abs(centsBetween(result.freq, median(h))) < 100;

    if (result && (attack || sustain)) {
      if (attack && h.length && Math.abs(centsBetween(result.freq, median(h))) >= 100) {
        h.length = 0; // a different string was plucked
      }
      h.push(result.freq);
      if (h.length > 7) h.shift();
      lastHeard.current = now;

      const r = toReading(median(h));
      setReading(r);
      setHeld(false);

      if (r.stringIndex >= 0 && Math.abs(r.cents) <= IN_TUNE_CENTS) {
        if (!inTuneSince.current) inTuneSince.current = now;
        if (now - inTuneSince.current > IN_TUNE_HOLD_MS) {
          setTuned((t) => (t.includes(r.stringIndex) ? t : [...t, r.stringIndex]));
        }
      } else {
        inTuneSince.current = 0;
      }
    } else if (h.length) {
      // No usable signal: keep showing the last reading for a while, dimmed, before clearing.
      if (now - lastHeard.current > HOLD_MS) resetReading();
      else if (now - lastHeard.current > DIM_AFTER_MS) setHeld(true);
    }
  };
  const onWindowRef = useRef(onWindow);
  onWindowRef.current = onWindow;

  const start = useCallback(async () => {
    setError(null);
    try {
      mic.current = await startMicrophone((s, sr) => onWindowRef.current(s, sr));
      setListening(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const stop = useCallback(() => {
    mic.current?.stop();
    mic.current = null;
    setListening(false);
    resetReading();
  }, [resetReading]);

  useEffect(() => () => mic.current?.stop(), []);

  return { listening, error, reading, held, tuned, start, stop };
}
