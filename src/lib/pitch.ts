/**
 * Sruti model and pitch math.
 *
 * The sruti (base pitch of Sa) is anchored to a Western note name purely as a
 * convenient reference point (A4 = 440 Hz); everything ABOVE Sa is pure just
 * intonation via raga ratios — see docs/ARCHITECTURE.md "Intonation model".
 */

export const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

/** Traditional kattai (harmonium/flute size) label for each Western note. */
export const KATTAI: Record<NoteName, string> = {
  C: '1', 'C#': '1.5',
  D: '2', 'D#': '2.5',
  E: '3',
  F: '4', 'F#': '4.5',
  G: '5', 'G#': '5.5',
  A: '6', 'A#': '6.5',
  B: '7',
};

export interface Sruti {
  note: NoteName;
  /** Scientific pitch octave; A#2 ≈ 116.54 Hz is a typical male sruti. */
  octave: number;
}

export function srutiToHz({ note, octave }: Sruti): number {
  const midi = (octave + 1) * 12 + NOTE_NAMES.indexOf(note);
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Frequency of a swara: sruti × JI ratio. Sthayi shifts by octaves if needed. */
export function swaraHz(sruti: Sruti, ratio: [number, number]): number {
  return (srutiToHz(sruti) * ratio[0]) / ratio[1];
}

/** Interval of a JI ratio in cents (e.g. [16,15] → ≈111.73). */
export function ratioToCents([num, den]: [number, number]): number {
  return 1200 * Math.log2(num / den);
}

export function srutiLabel(sruti: Sruti): string {
  return `${sruti.note}${sruti.octave} · ${KATTAI[sruti.note]} kattai`;
}
