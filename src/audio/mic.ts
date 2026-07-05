/**
 * Microphone capture + pitch detection (pitchy, McLeod Pitch Method).
 *
 * ARCHITECTURE.md audio rules applied here:
 * - #2: echoCancellation / noiseSuppression / autoGainControl are explicitly
 *   disabled — OS voice processing mangles soft singing.
 * - #3: the detector always uses audioContext.sampleRate, never a constant.
 * - Raw pitch + clarity + level are reported; thresholds/judgement belong to
 *   the caller (the tuner smooths, exercises will score).
 */

import { PitchDetector } from 'pitchy';
import { ensureRunningContext, setAudioSessionType } from './context';

export interface PitchSample {
  /** Detected fundamental in Hz (unfiltered — check clarity). */
  hz: number;
  /** 0..1 — how periodic the signal is; gate on ~0.9 for voice. */
  clarity: number;
  /** RMS level 0..1 — gate on ~0.01 to ignore room noise. */
  rms: number;
}

export interface MicSession {
  stop(): void;
}

const FFT_SIZE = 2048;
const POLL_MS = 50;

export async function startMic(
  onSample: (sample: PitchSample) => void,
): Promise<MicSession> {
  // Capture is incompatible with the 'playback' session category.
  setAudioSessionType('play-and-record');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  } catch (err) {
    setAudioSessionType('playback');
    throw err;
  }
  const ctx = await ensureRunningContext();

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  source.connect(analyser);
  // Not connected to destination: we listen, we don't monitor.

  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  const buffer = new Float32Array(analyser.fftSize);

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buffer);
    let sumSquares = 0;
    for (const v of buffer) sumSquares += v * v;
    const rms = Math.sqrt(sumSquares / buffer.length);
    const [hz, clarity] = detector.findPitch(buffer, ctx.sampleRate);
    onSample({ hz, clarity, rms });
  }, POLL_MS);

  return {
    stop() {
      clearInterval(timer);
      source.disconnect();
      for (const track of stream.getTracks()) track.stop();
      setAudioSessionType('playback');
    },
  };
}
