import { describe, expect, it } from 'vitest';
import { mayamalavagowla } from '../data/ragas';
import { KATTAI, ratioToCents, srutiToHz, swaraHz, type Sruti } from './pitch';

const A_SHARP_2: Sruti = { note: 'A#', octave: 2 };
const B_2: Sruti = { note: 'B', octave: 2 };

describe('sruti base frequency', () => {
  it('A#2 (default sruti) is ~116.54 Hz', () => {
    expect(srutiToHz(A_SHARP_2)).toBeCloseTo(116.5409, 3);
  });

  it('B2 (alternate teacher recommendation) is ~123.47 Hz', () => {
    expect(srutiToHz(B_2)).toBeCloseTo(123.4708, 3);
  });

  it('A4 anchors to 440', () => {
    expect(srutiToHz({ note: 'A', octave: 4 })).toBeCloseTo(440, 9);
  });
});

describe('just intonation — Mayamalavagowla', () => {
  const bySwara = Object.fromEntries(
    mayamalavagowla.swaras.map((s) => [s.id, s]),
  );

  it('has the eight arohana swaras in order', () => {
    expect(mayamalavagowla.swaras.map((s) => s.id)).toEqual([
      'S', 'R1', 'G3', 'M1', 'P', 'D1', 'N3', 'S+',
    ]);
  });

  it.each([
    ['S', 0],
    ['R1', 111.73],
    ['G3', 386.31],
    ['M1', 498.04],
    ['P', 701.96],
    ['D1', 813.69],
    ['N3', 1088.27],
    ['S+', 1200],
  ])('%s sits at %s cents above Sa (JI, not ET)', (id, cents) => {
    expect(ratioToCents(bySwara[id].ratio)).toBeCloseTo(cents as number, 1);
  });

  it('Ga at A#2 sruti is exactly 5/4 over Sa (~145.68 Hz)', () => {
    expect(swaraHz(A_SHARP_2, bySwara['G3'].ratio)).toBeCloseTo(
      (116.5409 * 5) / 4,
      2,
    );
  });

  it('R1 differs from equal temperament by ~11.7 cents (the point of JI)', () => {
    const jiCents = ratioToCents(bySwara['R1'].ratio);
    expect(Math.abs(jiCents - 100)).toBeGreaterThan(11);
    expect(Math.abs(jiCents - 100)).toBeLessThan(13);
  });

  it('tara Sa is an exact octave', () => {
    expect(swaraHz(A_SHARP_2, bySwara['S+'].ratio)).toBeCloseTo(
      2 * srutiToHz(A_SHARP_2),
      9,
    );
  });
});

describe('sthayi names (relative to madhya Sa)', () => {
  it('maps octave offsets to the five traditional sthayis', async () => {
    const { sthayiName } = await import('./pitch');
    expect(sthayiName(0)).toBe('madhya sthayi');
    expect(sthayiName(1)).toBe('tara sthayi');
    expect(sthayiName(-1)).toBe('mandra sthayi');
    expect(sthayiName(2)).toBe('atitara sthayi');
    expect(sthayiName(-2)).toBe('anumandra sthayi');
    expect(sthayiName(-3)).toBe('anumandra sthayi');
  });
});

describe('kattai labels', () => {
  it('maps the traditional numbering', () => {
    expect(KATTAI['C']).toBe('1');
    expect(KATTAI['A#']).toBe('6.5');
    expect(KATTAI['B']).toBe('7');
    expect(KATTAI['G']).toBe('5');
  });
});
