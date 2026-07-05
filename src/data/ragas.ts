/**
 * Raga definitions. Per docs/ARCHITECTURE.md: all intervals are 5-limit
 * just-intonation ratios relative to Sa. Equal temperament is never used.
 * Ratios are carried per raga because the same swarasthana may be shaded
 * differently in different ragas.
 */

export interface Swara {
  /** Short id used in exercise data files, e.g. "S", "R1", "S+" (tara sthayi). */
  id: string;
  /** Display name, e.g. "Sa", "Ri₁". */
  label: string;
  /** Full traditional name. */
  name: string;
  /** JI ratio relative to Sa as [numerator, denominator]. */
  ratio: [number, number];
}

export interface Raga {
  id: string;
  name: string;
  melakarta?: number;
  /** Arohana order. Tara-sthayi Sa is included explicitly as "S+". */
  swaras: Swara[];
}

export const mayamalavagowla: Raga = {
  id: 'mayamalavagowla',
  name: 'Mayamalavagowla',
  melakarta: 15,
  swaras: [
    { id: 'S',  label: 'Sa',  name: 'Shadja',           ratio: [1, 1] },
    { id: 'R1', label: 'Ri₁', name: 'Shuddha Rishabha', ratio: [16, 15] },
    { id: 'G3', label: 'Ga₃', name: 'Antara Gandhara',  ratio: [5, 4] },
    { id: 'M1', label: 'Ma₁', name: 'Shuddha Madhyama', ratio: [4, 3] },
    { id: 'P',  label: 'Pa',  name: 'Panchama',         ratio: [3, 2] },
    { id: 'D1', label: 'Da₁', name: 'Shuddha Dhaivata', ratio: [8, 5] },
    { id: 'N3', label: 'Ni₃', name: 'Kakali Nishada',   ratio: [15, 8] },
    { id: 'S+', label: 'Ṡa',  name: 'Tara Shadja',      ratio: [2, 1] },
  ],
};
