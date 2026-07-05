# Carnatic Practice App — Architecture

A private, offline-capable practice companion for learning Carnatic music, built to
grow with the learner's progression (currently: pre-Sarali Varisai fundamentals through
Sarali Varisai). Runs identically on iPhone and Mac as an installable PWA.

## Core principles

1. **Lessons are data, not code.** Ragas, talas, and exercises are JSON/TS data files
   consumed by generic engines (renderer, synthesizer, tala clock, scorer). Advancing to
   a new lesson stage means adding data files, not features.
2. **Ear and voice progress together.** Every melodic concept gets both a *production*
   exercise (sing it, with pitch feedback) and a *perception* exercise (hear it over the
   drone, identify it). Listening skill is a first-class goal of the app at every stage,
   not a side feature. New exercise stages MUST ship with a matching ear-training
   variant.
3. **Just intonation from day one.** All reference pitch — synthesized swaras and
   scoring targets — uses just-intonation ratios relative to Sa. Equal temperament
   is never used anywhere in the app. See "Intonation model".
4. **Cross-device consistency: verify, don't trust.** One audio codebase (Web Audio API)
   on both devices, plus explicit mitigations and a built-in calibration screen. See
   "Audio consistency mitigations".
5. **Offline-first, no backend.** Static PWA; all progress in on-device storage
   (IndexedDB via a thin wrapper). Nothing leaves the device.

## Stack

- Vite + Svelte + TypeScript
- `vite-plugin-pwa` (service worker, manifest, offline caching)
- Web Audio API directly (no audio framework); `pitchy` (McLeod/MPM) for pitch
  detection, running in an AudioWorklet
- Static hosting on **GitHub Pages** (decided 2026-07; repo will be public on the free
  plan — acceptable since no personal data ever leaves the device), deployed by a
  GitHub Actions workflow on push to `main`. Installed via Add to Home Screen (iOS) /
  Add to Dock (macOS Safari). Note: Vite `base` must be set to the repo path unless a
  custom domain is used.

## Audio consistency mitigations (binding rules)

The user practices on both a Mac and an iPhone. Practice feedback must never differ
because of device, OS DSP, or library behavior. These rules are binding for all audio
code:

1. **One library, one codebase.** All audio goes through the Web Audio API in shared
   TypeScript. Never introduce platform-specific audio paths.
2. **Disable OS voice processing on capture.** Every `getUserMedia` call MUST request
   `{ echoCancellation: false, noiseSuppression: false, autoGainControl: false }`.
   These are tuned for phone calls and can gate or distort soft singing.
3. **Never hardcode a sample rate.** iPhone typically captures at 48 kHz, Macs often
   44.1 kHz. All frequency math MUST read `audioContext.sampleRate` at runtime.
4. **Schedule on the audio clock only.** All ticks and swara onsets are
   scheduled via `AudioContext.currentTime` with a lookahead scheduler (~25 ms tick,
   ~100 ms lookahead). UI highlighting is driven from the same schedule, compensated by
   `baseLatency`/`outputLatency`. `setTimeout`/`requestAnimationFrame` are for painting
   only, never for audio timing.
5. **Judge in cents relative to the user's sruti, never absolute Hz.** Both devices are
   measured against the same yardstick; mic frequency-response differences affect
   amplitude, not pitch, and are irrelevant to cents-from-target.
6. **Drone bleed strategy.** The user plays tanpura from an EXTERNAL source (physical
   shruti box or another app) — this app does not synthesize a drone (decided 2026-07).
   During sung-pitch exercises the mic will hear that external drone. Its frequencies
   are still known (Sa/Pa at the configured sruti): prefer MPM/YIN clarity thresholds to
   reject the steady drone, and if needed suppress detection candidates within a few
   cents of drone partials.
7. **Bluetooth caution.** Warn (in-UI) when output is Bluetooth during timing- or
   pitch-feedback exercises; latency is large and variable.
8. **iOS specifics.** AudioContext must be created/resumed inside a user gesture. Mic
   permission may re-prompt per session; `deviceId`s are not stable across loads — never
   persist them.
9. **Calibration screen as acceptance test.** The tuner screen shows live detected
   pitch. Cross-device check: play Sa on the Mac, point the iPhone at it (and vice
   versa) — both must agree within a few cents. Any disagreement is a bug, not a
   tolerance.

## Intonation model

All pitch is derived as `sruti_Hz × ratio` with 5-limit just-intonation ratios defined
**per raga** (the same swarasthana may be shaded differently in different ragas later).

Mayamalavagowla (raga #15), the raga of all beginner exercises:

| Swara | Name              | Ratio | Cents from Sa |
|-------|-------------------|-------|----------------|
| S     | Shadja            | 1/1   | 0              |
| R1    | Shuddha Rishabha  | 16/15 | 112            |
| G3    | Antara Gandhara   | 5/4   | 386            |
| M1    | Shuddha Madhyama  | 4/3   | 498            |
| P     | Panchama          | 3/2   | 702            |
| D1    | Shuddha Dhaivata  | 8/5   | 814            |
| N3    | Kakali Nishada    | 15/8  | 1088           |
| Ṡ     | Tara Shadja       | 2/1   | 1200           |

Notes:
- Cents are shown rounded; computation always uses the exact ratios.
- Note for later: some ragas/schools use alternate shadings (e.g. a lower R1 of
  256/243). The raga data format carries the ratios, so this is a data change.
- Scoring displays deviation in cents from the JI target; tolerance bands are
  configurable per exercise type.

## Exercise type system

An exercise is `{ id, type, title, raga, params }`. Engines dispatch on `type`.
Initial types:

- **`sustain`** — hold one target swara (S R G M P D N Ṡ) against the drone.
  Metrics: time-on-pitch, mean deviation (cents), stability (std-dev cents), breath
  duration. This is the pre-Sarali "swara sustenance" fundamental.
  **Feedback default: blind mode** — no live meter during the hold (sing by ear against
  the drone), full pitch trace + stability report after the attempt. A toggle enables a
  live pitch trace for users who want it. (Deliberate pedagogy choice: avoids "chasing
  the meter"; decided 2026-07.)
- **`sequence`** — a swara sequence in a tala at speeds 1/2/3 (Sarali Varisai 1–14;
  later Janta etc. reuse this type). Modes: *listen* (app plays) and *practice*
  (drone + tala, user sings).
- **`ear-identify`** — app plays a swara (later: short phrases) over the drone; user
  identifies it. Progressive ladder (decided 2026-07): early levels answer by **tapping**
  the swara name (pure recognition, subset of swaras → all 8); later levels require
  **singing the heard swara back**, verified by the pitch detector (voice–ear link);
  eventually short phrases. Same drone-anchored approach as functional ear trainers —
  recognition is always relative to Sa, never isolated intervals.

Every future stage adds its data under these types or introduces a new type with the
same contract (render, play, score, log).

## Module layout

```
src/
  data/            ragas.ts, talas.ts, exercises/*.json
  audio/
    context.ts     shared AudioContext, unlock-on-gesture
    synth.ts       swara synthesizer (JI, envelope, schedulable)
    talaClock.ts   lookahead scheduler; emits audio ticks + UI beat events
    pitch/         AudioWorklet capture + pitchy analysis → cents stream
  engine/          exercise runners + scoring per type
  ui/              Svelte routes: Home, Practice, EarTraining, Tuner, Log, Settings
  storage/         IndexedDB wrapper: settings (sruti, tempo), practice log, scores
```

## Screens

1. **Home** — free-form lesson list (Fundamentals: sustain + ear training; Sarali
   Varisai 1–14) with per-speed status. **No forced progression or unlocking** (decided
   2026-07): the user's teacher decides when to advance; the app never gates content.
2. **Practice (sequence)** — notation with synced highlight, tala gesture visual,
   speed/loop controls, listen vs practice modes (external tanpura assumed).
3. **Sustain** — big pitch meter: target swara line, live sung pitch, hold timer,
   post-attempt stability report.
4. **Ear training** — mystery swara over the user's external drone; tap-to-answer or
   sing-back. (App may play a brief Sa reference before each round since it does not
   run its own drone.)
5. **Tuner / Calibration** — live pitch in swara + cents; cross-device check
   instructions.
6. **Log** — automatic practice history, streaks, per-exercise metrics over time.
7. **Settings** — sruti, tempo, tolerance, sustain live-meter toggle.
   **Sruti default: A# (6.5 kattai)** — the user's teachers have recommended A# or B;
   the picker shows Western + kattai labels, is octave-aware (Sa around A#2 for a male
   voice), and must make changing sruti trivial since it may move as the voice develops.

## Verification

- Unit tests: ratio math, tala arithmetic, scheduler drift bounds, scorer.
- Manual acceptance per milestone on BOTH devices; calibration cross-check
  (§ mitigations #9) is part of every release checklist.
- Pitch pipeline test: feed synthesized known-frequency signals through the detector;
  detected cents error must be < 2¢.
