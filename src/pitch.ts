// Pitch detection with the McLeod Pitch Method (normalized square difference function).
// Pure TypeScript so it runs identically in the browser and on the phone.

export const MIN_FREQ = 55;
export const MAX_FREQ = 1200;

export type PitchResult = { freq: number; clarity: number; rms: number };

/** Below this level the signal is treated as silence. */
export const SILENCE_RMS = 0.0012;

// Guitar fundamentals stay under ~1.2 kHz, so analyzing above ~24 kHz only costs CPU.
// This matters on the phone, where the JS engine has no JIT.
const ANALYSIS_RATE = 24000;

function downsample(data: Float32Array, sampleRate: number) {
  const factor = Math.max(1, Math.floor(sampleRate / ANALYSIS_RATE));
  if (factor === 1) return { data, sampleRate };
  const out = new Float32Array(Math.floor(data.length / factor));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let k = 0; k < factor; k++) sum += data[i * factor + k];
    out[i] = sum / factor; // averaging doubles as a simple low-pass filter
  }
  return { data: out, sampleRate: sampleRate / factor };
}

let nsdf = new Float32Array(0);

export function detectPitch(input: Float32Array, inputRate: number): PitchResult | null {
  const { data, sampleRate } = downsample(input, inputRate);
  const n = data.length;

  let rms = 0;
  for (let i = 0; i < n; i++) rms += data[i] * data[i];
  rms = Math.sqrt(rms / n);
  if (rms < SILENCE_RMS) return null;

  const minLag = Math.floor(sampleRate / MAX_FREQ);
  const maxLag = Math.min(Math.ceil(sampleRate / MIN_FREQ), n - 2);
  if (nsdf.length !== maxLag + 2) nsdf = new Float32Array(maxLag + 2);

  for (let tau = 0; tau <= maxLag + 1; tau++) {
    let acf = 0;
    let m = 0;
    for (let j = 0, end = n - tau; j < end; j++) {
      const a = data[j];
      const b = data[j + tau];
      acf += a * b;
      m += a * a + b * b;
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }

  // Collect the highest point of each positive lobe after the first zero crossing.
  const peaks: number[] = [];
  let tau = 1;
  while (tau <= maxLag && nsdf[tau] > 0) tau++;
  let best = -1;
  let bestIdx = -1;
  for (; tau <= maxLag; tau++) {
    if (nsdf[tau] > 0) {
      if (nsdf[tau] > best) {
        best = nsdf[tau];
        bestIdx = tau;
      }
    } else if (bestIdx >= 0) {
      peaks.push(bestIdx);
      best = -1;
      bestIdx = -1;
    }
  }
  if (bestIdx >= 0) peaks.push(bestIdx);
  if (!peaks.length) return null;

  let highest = 0;
  for (const p of peaks) highest = Math.max(highest, nsdf[p]);
  const idx = peaks.find((p) => p >= minLag && nsdf[p] >= 0.9 * highest);
  if (idx === undefined) return null;

  // Parabolic interpolation around the peak for sub-sample accuracy.
  const a = nsdf[idx - 1];
  const b = nsdf[idx];
  const c = nsdf[idx + 1];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (a - c) / (2 * denom) : 0;
  return { freq: sampleRate / (idx + shift), clarity: b, rms };
}
