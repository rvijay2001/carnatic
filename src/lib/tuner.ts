/**
 * Map a detected frequency to the nearest swara of a raga, octave-agnostic,
 * judged in cents relative to the user's sruti (ARCHITECTURE.md audio rule #5:
 * never absolute Hz).
 */

import type { Raga } from '../data/ragas';
import { srutiToHz, ratioToCents, type Sruti } from './pitch';

export interface SwaraReading {
  swaraId: string;
  label: string;
  /** Signed deviation from the JI target, in cents (negative = flat). */
  centsOff: number;
  /** Octaves above (+) or below (−) the sruti's madhya-sthayi Sa. */
  octaveOffset: number;
  hz: number;
}

/** Wrap a cents difference into [-600, 600). */
function wrapCents(diff: number): number {
  return ((((diff + 600) % 1200) + 1200) % 1200) - 600;
}

export function nearestSwara(
  hz: number,
  sruti: Sruti,
  raga: Raga,
): SwaraReading | null {
  if (!(hz > 0)) return null;
  const centsFromSa = 1200 * Math.log2(hz / srutiToHz(sruti));

  let best: { swaraId: string; label: string; diff: number; target: number } | null =
    null;
  for (const swara of raga.swaras) {
    const target = ratioToCents(swara.ratio);
    if (target >= 1200) continue; // tara Sa folds onto Sa
    const diff = wrapCents(centsFromSa - target);
    if (!best || Math.abs(diff) < Math.abs(best.diff)) {
      best = { swaraId: swara.id, label: swara.label, diff, target };
    }
  }
  if (!best) return null;

  return {
    swaraId: best.swaraId,
    label: best.label,
    centsOff: best.diff,
    octaveOffset: Math.round((centsFromSa - best.target - best.diff) / 1200),
    hz,
  };
}
