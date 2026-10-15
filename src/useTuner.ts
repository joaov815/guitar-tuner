import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { GESTURE_REQUIRED, startMicrophone, type MicHandle } from './audio';
import { centsBetween, freqToMidi, midiToFreq } from './music';
import { detectPitch, MAX_FREQ, MIN_FREQ } from './pitch';

const ATTACK_RMS = 0.006; // loudness needed to lock onto a new note
const SUSTAIN_RMS = 0.0012; // keep tracking a locked note down to this level
const ATTACK_CLARITY = 0.85;
const SUSTAIN_CLARITY = 0.6;
const HOLD_MS = 3000; // keep the last reading on screen this long after the signal fades
const DIM_AFTER_MS = 250;
const ANALYSIS_INTERVAL_MS = 40; // ~25 pitch estimates per second
export const IN_TUNE_CENTS = 5;
export const CLOSE_CENTS = 15;

export type Reading = {
  freq: number;
  /** Nearest equal-tempered note. */
  midi: number;
  /** Offset from that note, -50…+50. */
  cents: number;
};

export type TunerStatus = 'starting' | 'listening' | 'needs-tap' | 'error';

const median = (arr: number[]) => [...arr].sort((x, y) => x - y)[Math.floor(arr.length / 2)];

/** Map RMS to a 0…1 meter value on a -60…-10 dBFS scale. */
const toLevel = (rms: number) => Math.max(0, Math.min(1, (20 * Math.log10(rms + 1e-9) + 60) / 50));

function toReading(freq: number): Reading {
  const midi = Math.round(freqToMidi(freq));
  return { freq, midi, cents: centsBetween(freq, midiToFreq(midi)) };
}

/** Chromatic tuner: listens from mount and reports the nearest note. */
export function useTuner() {
  const [status, setStatus] = useState<TunerStatus>('starting');
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [held, setHeld] = useState(false);
  const [level, setLevel] = useState(0);

  const mic = useRef<MicHandle | null>(null);
  const starting = useRef(false);
  const history = useRef<number[]>([]);
  const lastHeard = useRef(0);
  const lastAnalysis = useRef(0);

  const resetReading = useCallback(() => {
    history.current = [];
    setReading(null);
    setHeld(false);
  }, []);

  const onWindow = useCallback(
    (samples: Float32Array, sampleRate: number) => {
      const now = Date.now();
      if (now - lastAnalysis.current < ANALYSIS_INTERVAL_MS) return;
      lastAnalysis.current = now;

      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      setLevel(toLevel(Math.sqrt(sum / samples.length)));

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
        setReading(toReading(median(h)));
        setHeld(false);
      } else if (h.length) {
        // No usable signal: keep showing the last reading for a while, dimmed, before clearing.
        if (now - lastHeard.current > HOLD_MS) resetReading();
        else if (now - lastHeard.current > DIM_AFTER_MS) setHeld(true);
      }
    },
    [resetReading],
  );

  const start = useCallback(async () => {
    if (mic.current || starting.current) return;
    starting.current = true;
    setError(null);
    try {
      mic.current = await startMicrophone(onWindow);
      setStatus('listening');
    } catch (e) {
      const message = (e as Error).message;
      if (message === GESTURE_REQUIRED) setStatus('needs-tap');
      else {
        setStatus('error');
        setError(message);
      }
    } finally {
      starting.current = false;
    }
  }, [onWindow]);

  const stop = useCallback(() => {
    mic.current?.stop();
    mic.current = null;
    setLevel(0);
    resetReading();
  }, [resetReading]);

  // Start listening as soon as the screen mounts; release the mic on unmount.
  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  // On the phone, let go of the mic in the background and pick it back up on return
  // (this also retries after the user enables microphone access in Settings).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else if (state === 'background') {
        stop();
        setStatus('starting');
      }
    });
    return () => sub.remove();
  }, [start, stop]);

  return { status, error, reading, held, level, start };
}
