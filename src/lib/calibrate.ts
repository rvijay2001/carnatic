/**
 * Loopback self-calibration for capture-rate mismatch.
 *
 * WebKit on macOS can run the AudioContext at the output clock (48 kHz)
 * while the microphone captures at 44.1 kHz, feeding samples through
 * unresampled — every detected pitch then reads sharp by exactly 48/44.1
 * (+147 cents). The device plays its own Sa and listens: the measured/true
 * ratio must be one of the known hardware ratios, so we snap to it (within
 * a tolerance) and store the factor per device. Anything that doesn't snap
 * is rejected — a speaker or mic cannot shift pitch by itself.
 */

export interface Correction {
  /** Detected pitches must be DIVIDED by this factor. */
  factor: number;
  label: string;
}

const CANDIDATES: Correction[] = [
  { factor: 1, label: 'none needed' },
  { factor: 48000 / 44100, label: 'engine 48 kHz reading a 44.1 kHz mic' },
  { factor: 44100 / 48000, label: 'engine 44.1 kHz reading a 48 kHz mic' },
];

const TOLERANCE_CENTS = 25;

/**
 * Infer the correction from a loopback measurement. Octave errors in the
 * measurement (harmonics) are folded away first.
 */
export function inferCorrection(
  measuredHz: number,
  expectedHz: number,
): Correction | null {
  if (!(measuredHz > 0) || !(expectedHz > 0)) return null;
  let ratio = measuredHz / expectedHz;
  while (ratio > Math.SQRT2) ratio /= 2;
  while (ratio < Math.SQRT1_2) ratio *= 2;

  let best: Correction | null = null;
  let bestCents = Infinity;
  for (const candidate of CANDIDATES) {
    const cents = Math.abs(1200 * Math.log2(ratio / candidate.factor));
    if (cents < bestCents) {
      bestCents = cents;
      best = candidate;
    }
  }
  return bestCents <= TOLERANCE_CENTS ? best : null;
}

export function correctionCents(factor: number): number {
  return 1200 * Math.log2(factor);
}
