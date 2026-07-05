import { describe, expect, it } from 'vitest';
import { mayamalavagowla } from '../data/ragas';
import { srutiToHz, type Sruti } from './pitch';
import { nearestSwara } from './tuner';

const SRUTI: Sruti = { note: 'A#', octave: 2 };
const SA = srutiToHz(SRUTI);

describe('nearestSwara', () => {
  it('identifies an exact Sa at 0 cents', () => {
    const r = nearestSwara(SA, SRUTI, mayamalavagowla)!;
    expect(r.swaraId).toBe('S');
    expect(r.centsOff).toBeCloseTo(0, 5);
    expect(r.octaveOffset).toBe(0);
  });

  it('identifies exact JI Ga (5/4 over Sa)', () => {
    const r = nearestSwara((SA * 5) / 4, SRUTI, mayamalavagowla)!;
    expect(r.swaraId).toBe('G3');
    expect(r.centsOff).toBeCloseTo(0, 5);
  });

  it('is octave-agnostic: tara Sa reads as Sa, octave +1', () => {
    const r = nearestSwara(SA * 2, SRUTI, mayamalavagowla)!;
    expect(r.swaraId).toBe('S');
    expect(r.centsOff).toBeCloseTo(0, 5);
    expect(r.octaveOffset).toBe(1);
  });

  it('mandra Pa reads as Pa, octave −1', () => {
    const r = nearestSwara((SA * 3) / 2 / 2, SRUTI, mayamalavagowla)!;
    expect(r.swaraId).toBe('P');
    expect(r.octaveOffset).toBe(-1);
  });

  it('reports a 10-cent-sharp Ri as R1 +10¢', () => {
    const hz = SA * (16 / 15) * 2 ** (10 / 1200);
    const r = nearestSwara(hz, SRUTI, mayamalavagowla)!;
    expect(r.swaraId).toBe('R1');
    expect(r.centsOff).toBeCloseTo(10, 3);
  });

  it('reports flat deviations as negative', () => {
    const hz = SA * (3 / 2) * 2 ** (-25 / 1200);
    const r = nearestSwara(hz, SRUTI, mayamalavagowla)!;
    expect(r.swaraId).toBe('P');
    expect(r.centsOff).toBeCloseTo(-25, 3);
  });

  it('picks the closer swara on either side of the Sa–Ri midpoint (55.9¢)', () => {
    const at50 = nearestSwara(SA * 2 ** (50 / 1200), SRUTI, mayamalavagowla)!;
    expect(at50.swaraId).toBe('S');
    const at60 = nearestSwara(SA * 2 ** (60 / 1200), SRUTI, mayamalavagowla)!;
    expect(at60.swaraId).toBe('R1');
  });

  it('rejects nonsense input', () => {
    expect(nearestSwara(0, SRUTI, mayamalavagowla)).toBeNull();
    expect(nearestSwara(NaN, SRUTI, mayamalavagowla)).toBeNull();
  });
});
