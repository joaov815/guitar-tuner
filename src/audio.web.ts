// Web audio: microphone via getUserMedia + AnalyserNode. Native builds use audio.ts.
import { playToneOn, type ToneContext } from './tone';

export const WINDOW_SIZE = 2048;
/** Thrown when the browser won't run audio until the user taps the page. */
export const GESTURE_REQUIRED = 'GESTURE_REQUIRED';

export type MicHandle = { stop: () => void };
export type OnWindow = (samples: Float32Array, sampleRate: number) => void;

let ctx: AudioContext | null = null;

function getContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new Ctor() as AudioContext;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export async function startMicrophone(onWindow: OnWindow): Promise<MicHandle> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      `Your browser blocks the microphone on pages that aren't HTTPS. ` +
        `Open https://${location.host}${location.pathname} instead (or localhost on this computer).`,
    );
  }

  // Browsers keep audio suspended until the user interacts with the page. When the tuner
  // auto-starts on load, ask for a tap instead of silently analyzing nothing.
  const audio = getContext();
  if (audio.state !== 'running') {
    await Promise.race([audio.resume(), new Promise((r) => setTimeout(r, 300))]);
    // resume() may have changed the state since the check above.
    if ((audio.state as AudioContextState) !== 'running') throw new Error(GESTURE_REQUIRED);
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    const name = (err as Error).name;
    throw new Error(
      name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow it in your browser’s site settings and try again.'
        : `Couldn't access the microphone (${name}).`,
    );
  }

  const analyser = audio.createAnalyser();
  analyser.fftSize = WINDOW_SIZE;
  const source = audio.createMediaStreamSource(stream);
  source.connect(analyser);

  const buf = new Float32Array(WINDOW_SIZE);
  let frame = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    onWindow(buf, audio.sampleRate);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    stop: () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

export function playTone(freq: number) {
  playToneOn(getContext() as unknown as ToneContext, freq);
}
