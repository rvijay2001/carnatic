# Backlog

## Open issues

### 1. iPhone: first tap after launch is silent
- Symptom: on a fresh launch of the installed PWA, the first swara pressed
  (e.g. Sa) never sounds, even waiting; a different swara works a few seconds
  later, and the first one works after that.
- Attempted fix (commit 0af5594): notes wait for a running AudioContext and
  have a 300 ms minimum duration. **User reports still broken.**
- Next debugging steps:
  - Confirm the phone is actually running the fixed build (footer build stamp
    added in M2 — check it first; iOS service-worker update lag is a suspect).
  - Attach Safari Web Inspector from the Mac to the iPhone PWA (iPhone:
    Settings → Safari → Advanced → Web Inspector; Mac Safari: Develop menu)
    and log AudioContext.state transitions on first tap.
  - Try warming up the context on the FIRST touch anywhere in the document
    (capture-phase listener) rather than the first swara press.

### 2. iPhone: launching an external tanpura app permanently kills app audio
- Symptom: when an external tanpura app starts playing, this app's sounds stop
  and do not recover until the app is restarted. On macOS, mixing with external
  audio (QuickTime MP4) works fine.
- Attempted fix (commit 0af5594): `ensureRunningContext()` — resume with
  timeout, then close + rebuild wedged context; resume on visibilitychange.
  **User reports still broken.**
- Next debugging steps:
  - Same build-stamp check as issue 1 (both fixes shipped together; if the SW
    never updated, both "failures" may be stale code).
  - Web Inspector: check whether the rebuilt context reaches 'running' or the
    new context is also born 'interrupted'.
  - Identify which tanpura app is used and whether it opts into audio mixing;
    test against a known-mixable source (e.g. Music app).
  - If WebKit genuinely cannot reactivate the session while the other app
    holds it, document as platform limit and recommend tanpura on the other
    device; Capacitor wrapper is the escape hatch (native AVAudioSession
    control with `.playback` + `.mixWithOthers`).

### 3. Mac capture path reads pitch ×1.0526 (+89¢) — mechanism unidentified
- Measured 2026-07: Mac hears 490.7 Hz when 466.16 Hz is played (any source,
  capture-only or loopback); same ratio at 116 Hz (duet singing). Matches no
  standard sample-rate pair (48/44.1 would be +147¢). Mac OUTPUT is accurate
  (iPhone hears its tone correctly).
- Worked around by empirical calibration (stored per-device factor), but the
  root mechanism is unknown. Next: check engine/mic rates in the calibration
  message; check Audio MIDI Setup input device rate; test with an external
  mic; consider filing a WebKit bug with a minimal repro.

## Ideas / later
- Nicer swara timbre (sampled or Karplus-Strong voice).
- Wake lock during practice sessions (Screen Wake Lock API).
