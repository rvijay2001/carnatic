/**
 * Persisted app settings. M1 keeps this as a localStorage-backed Svelte store;
 * the practice log (later milestone) will use IndexedDB.
 */

import { writable } from 'svelte/store';
import type { Sruti } from './pitch';

export interface Settings {
  sruti: Sruti;
  showHz: boolean;
  /** Tuner: scrolling live pitch trace while singing (off = review-after only). */
  tunerLiveTrace: boolean;
  /** Tuner: show numeric Hz/cents readouts. */
  tunerNumbers: boolean;
}

/**
 * Defaults: sruti A#2; tuner is "blind" — no live feedback while singing,
 * trace shown after the phrase (anti pitch-chasing, user decision 2026-07).
 */
export const DEFAULT_SETTINGS: Settings = {
  sruti: { note: 'A#', octave: 2 },
  showHz: true,
  tunerLiveTrace: false,
  tunerNumbers: false,
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
