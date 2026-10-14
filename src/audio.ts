// Native (iOS/Android) audio: microphone via react-native-audio-api's AudioRecorder.
// The web build uses audio.web.ts instead.
import { AudioContext, AudioManager, AudioRecorder } from 'react-native-audio-api';

import { playToneOn, type ToneContext } from './tone';

export const WINDOW_SIZE = 2048;
/** Error message used by the web build when audio can't start without a tap; never thrown here. */
export const GESTURE_REQUIRED = 'GESTURE_REQUIRED';

export type MicHandle = { stop: () => void };
export type OnWindow = (samples: Float32Array, sampleRate: number) => void;

let sessionConfigured = false;
let toneCtx: AudioContext | null = null;

function configureSession() {
  if (sessionConfigured) return;
  // 'measurement' turns off iOS voice processing (AGC, noise suppression) that would distort pitch.
  AudioManager.setAudioSessionOptions({
    iosCategory: 'playAndRecord',
    iosMode: 'measurement',
    iosOptions: ['defaultToSpeaker', 'allowBluetoothA2DP'],
  });
  sessionConfigured = true;
}

export async function startMicrophone(onWindow: OnWindow): Promise<MicHandle> {
  const permission = await AudioManager.requestRecordingPermissions();
  if (permission !== 'Granted') {
    throw new Error('Microphone access is off. Turn it on in Settings → Guitar Tuner → Microphone.');
  }
  configureSession();
  await AudioManager.setAudioSessionActivity(true);

  const recorder = new AudioRecorder();
  const window = new Float32Array(WINDOW_SIZE);
  const sampleRate = AudioManager.getDevicePreferredSampleRate() || 48000;

  // Chunks arrive in small pieces; keep a sliding window of the most recent samples.
  const subscribed = recorder.onAudioReady({ sampleRate, bufferLength: 1024, channelCount: 1 }, ({ buffer }) => {
    const chunk = buffer.getChannelData(0);
    if (chunk.length >= WINDOW_SIZE) {
      window.set(chunk.subarray(chunk.length - WINDOW_SIZE));
    } else {
      window.copyWithin(0, chunk.length);
      window.set(chunk, WINDOW_SIZE - chunk.length);
    }
    onWindow(window, buffer.sampleRate);
  });
  if (subscribed.status === 'error') throw new Error(subscribed.message);

  const started = await recorder.start();
  if (started.status === 'error') {
    recorder.clearOnAudioReady();
    throw new Error(started.message);
  }

  return {
    stop: () => {
      recorder.clearOnAudioReady();
      recorder.stop().catch(() => {});
    },
  };
}

export function playTone(freq: number) {
  configureSession();
  if (!toneCtx) toneCtx = new AudioContext();
  playToneOn(toneCtx as unknown as ToneContext, freq);
}
