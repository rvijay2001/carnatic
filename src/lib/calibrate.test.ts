import { describe, expect, it } from 'vitest';
import { correctionCents, inferCorrection } from './calibrate';

const SA = 116.5409;
const SHARP = 48000 / 44100; // +147¢ — Mac reading a 44.1k mic at 48k
const FLAT = 44100 / 48000;

describe('inferCorrection', () => {
  it('healthy device: measured == expected → factor 1', () => {
    expect(inferCorrection(SA, SA)?.factor).toBe(1);
  });

  it('small honest deviation (voice/speaker wobble) still snaps to 1', () => {
    expect(inferCorrection(SA * 2 ** (10 / 1200), SA)?.factor).toBe(1);
  });

  it('detects the 48/44.1 sharp mismatch (the Mac bug)', () => {
    expect(inferCorrection(SA * SHARP, SA)?.factor).toBeCloseTo(SHARP, 10);
  });

  it('detects the inverse (44.1/48) flat mismatch', () => {
    expect(inferCorrection(SA * FLAT, SA)?.factor).toBeCloseTo(FLAT, 10);
  });

  it('folds octave errors: detector locked on 2nd harmonic of a sharp device', () => {
    expect(inferCorrection(2 * SA * SHARP, SA)?.factor).toBeCloseTo(SHARP, 10);
  });

  it('rejects ambiguous measurements between candidates', () => {
    // +70¢ is ~70¢ from factor 1 and ~77¢ from the sharp ratio — no snap.
    expect(inferCorrection(SA * 2 ** (70 / 1200), SA)).toBeNull();
  });

  it('rejects nonsense', () => {
    expect(inferCorrection(0, SA)).toBeNull();
    expect(inferCorrection(NaN, SA)).toBeNull();
  });

  it('correctionCents reports the sharp ratio as ~+147¢', () => {
    expect(correctionCents(SHARP)).toBeCloseTo(147.1, 0);
  });
});

describe('empiricalCorrection', () => {
  it("accepts the Mac's measured +89¢ offset (490.7 Hz for 466.16)", async () => {
    const { empiricalCorrection } = await import('./calibrate');
    const corr = empiricalCorrection(490.7, 466.164)!;
    expect(corr.factor).toBeCloseTo(490.7 / 466.164, 6);
    expect(corr.label).toContain('+89');
  });

  it('folds octaves before measuring', async () => {
    const { empiricalCorrection } = await import('./calibrate');
    const corr = empiricalCorrection(2 * 490.7, 466.164)!;
    expect(corr.factor).toBeCloseTo(490.7 / 466.164, 6);
  });

  it('rejects offsets beyond 250¢ after folding', async () => {
    const { empiricalCorrection } = await import('./calibrate');
    expect(empiricalCorrection(SA * 2 ** (300 / 1200), SA)).toBeNull();
    expect(empiricalCorrection(0, SA)).toBeNull();
  });
});
