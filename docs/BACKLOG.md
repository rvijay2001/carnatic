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

### 3. [ROOT CAUSE FOUND] macOS Safari corrupts captured audio (+89¢, unstable)
- Diagnosis journey: Mac heard 490.7 Hz for a true 466.16 Hz tone (any source);
  same ×1.0526 (= 20/19) ratio at 116 Hz; readings unstable; simultaneous
  playback stuttered. Audio MIDI rates, mic mode, and input device all ruled
  out by user testing. **Control experiment settled it: Chrome on the same Mac
  reads identically to the iPhone** → WebKit capture-pipeline defect (dropped/
  misaligned chunks; same class as WebKit bug 253952). Empirical multiplier
  workaround was tried and REMOVED — glitched audio can't be fixed by scaling.
- Resolution: use Chrome on the Mac for microphone features (user accepted);
  the Tuner warns when running under macOS Safari.
- Optional follow-ups: file the WebKit bug (draft in docs/webkit-bug-draft.md);
  if ever needed, the untested code-side gamble is echoCancellation:true on
  Mac capture (Apple's voice-processing path may not glitch, but applies
  call-tuned processing to singing).

## Ideas / later
- Nicer swara timbre (sampled or Karplus-Strong voice).
- Wake lock during practice sessions (Screen Wake Lock API).
