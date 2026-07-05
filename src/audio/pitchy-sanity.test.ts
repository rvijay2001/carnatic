import { describe, expect, it } from 'vitest';
import { PitchDetector } from 'pitchy';

/**
 * Sanity-check the detector against our exact runtime configuration
 * (2048-sample buffer) for a low male sruti (A#2 ≈ 116.54 Hz): the tuner's
 * voicing gate assumes clarity is high for real singing — verify that
 * assumption for pure and voice-like (harmonic-rich) tones at both common
 * hardware rates.
 */

const BUFFER = 2048;
const SA = 116.5409;

function synth(
  freq: number,
  sampleRate: number,
  harmonics: number[],
): Float32Array {
  const buf = new Float32Array(BUFFER);
  for (let i = 0; i < BUFFER; i++) {
    let v = 0;
    harmonics.forEach((gain, h) => {
      v += gain * Math.sin((2 * Math.PI * freq * (h + 1) * i) / sampleRate);
    });
    buf[i] = v * 0.2;
  }
  return buf;
}

const VOICE = [1, 0.5, 0.3, 0.2, 0.1];

describe.each([44100, 48000])('pitchy at %d Hz', (rate) => {
  const detector = PitchDetector.forFloat32Array(BUFFER);

  it('pure sine at Sa: correct pitch, high clarity', () => {
    const [hz, clarity] = detector.findPitch(synth(SA, rate, [1]), rate);
    expect(hz).toBeCloseTo(SA, 0);
    expect(clarity).toBeGreaterThan(0.9);
  });

  it('voice-like tone at Sa: correct pitch, clarity above the entry gate', () => {
    const [hz, clarity] = detector.findPitch(synth(SA, rate, VOICE), rate);
    expect(hz).toBeCloseTo(SA, 0);
    expect(clarity).toBeGreaterThan(0.8);
  });

  it('voice-like tone at tara Sa (233 Hz)', () => {
    const [hz, clarity] = detector.findPitch(synth(SA * 2, rate, VOICE), rate);
    expect(hz).toBeCloseTo(SA * 2, 0);
    expect(clarity).toBeGreaterThan(0.8);
  });

  it('quiet voice-like tone (rms ~0.004) still clears the clarity gate', () => {
    const quiet = synth(SA, rate, VOICE).map((v) => v * 0.03) as Float32Array;
    const [hz, clarity] = detector.findPitch(quiet, rate);
    expect(hz).toBeCloseTo(SA, 0);
    expect(clarity).toBeGreaterThan(0.8);
  });
});
