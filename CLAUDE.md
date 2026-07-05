# Carnatic Practice App

A private Carnatic music practice companion (PWA for iPhone + Mac) that grows with the
owner's own learning progression. Currently covers pre-Sarali fundamentals (swara
sustain, ear training) and Sarali Varisai.

## Required reading

**Always read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before designing or changing
anything.** It contains binding rules — especially the audio consistency mitigations
and the intonation model. Keep it updated whenever the architecture evolves; it is the
source of truth, this file is only the pointer.

## Non-negotiables (details in ARCHITECTURE.md)

- Lessons are data files, not code. New lesson stages = new JSON, not new engines.
- Just intonation everywhere; equal temperament is never used.
- Every melodic concept ships with BOTH a singing exercise and an ear-training exercise.
- Audio rules: Web Audio only (no platform-specific paths); never hardcode sample
  rates; schedule on the audio clock; disable echoCancellation/noiseSuppression/
  autoGainControl on capture; feedback in cents relative to sruti, never raw Hz.
- Offline-first, no backend, no data leaves the device.

## Stack

Vite + Svelte 5 + TypeScript, vite-plugin-pwa; pitchy for pitch detection (from M2).

## Commands

- `npm run dev` — dev server
- `npm test` — unit tests (Vitest)
- `npm run check` — svelte-check + tsc
- `npm run build` — production build (includes PWA service worker)

## Deployment

Push to `main` → GitHub Actions builds, tests, and deploys to GitHub Pages at
https://rvijay2001.github.io/carnatic/ (Vite `base` is `/carnatic/`).
