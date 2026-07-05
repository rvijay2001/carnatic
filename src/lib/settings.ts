/**
 * Persisted app settings. M1 keeps this as a localStorage-backed Svelte store;
 * the practice log (later milestone) will use IndexedDB.
 */

import { writable } from 'svelte/store';
import type { Sruti } from './pitch';

export interface Settings {
  sruti: Sruti;
  showHz: boolean;
}

/** Default sruti: A#2 — see ARCHITECTURE.md (teachers recommended A# or B). */
export const DEFAULT_SETTINGS: Settings = {
  sruti: { note: 'A#', octave: 2 },
  showHz: true,
};

const STORAGE_KEY = 'carnatic.settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // Corrupt or unavailable storage — fall back to defaults.
  }
  return DEFAULT_SETTINGS;
}

export const settings = writable<Settings>(load());

settings.subscribe((value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private-mode or quota issues: settings simply won't persist.
  }
});
