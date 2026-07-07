# WebKit bug report draft

File at https://bugs.webkit.org (component: Media → WebRTC or Web Audio).

**Title:** macOS Safari: getUserMedia audio analyzed via Web Audio is
time-compressed ~20/19 (pitch reads ~+89 cents sharp) and unstable; Chrome on
the same machine is correct

**Environment:** macOS (Darwin 25.5), Safari <fill version>, MacBook Air
built-in microphone and speakers, both devices at matching sample rates in
Audio MIDI Setup (mismatch ruled out), Standard mic mode.

**Steps to reproduce:**
1. `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false,
   autoGainControl: false } })`
2. Connect `MediaStreamAudioSourceNode` → `AnalyserNode` (fftSize 2048) → muted
   `GainNode` → destination, in an `AudioContext` (default rate).
3. Play a steady external reference tone (e.g. 466.16 Hz sine from a phone) at
   the microphone.
4. Poll `getFloatTimeDomainData` every 50 ms and estimate pitch (McLeod/MPM,
   e.g. the `pitchy` library), using `audioContext.sampleRate`.

**Actual results (Safari/macOS):**
- Median detected pitch is ~490.7 Hz for a true 466.16 Hz tone — a factor of
  ~1.0526 ≈ 20/19, matching no sample-rate pair (48000/44100 would be 1.0884).
- Individual estimates are unstable (>15 cents spread) despite a clean tone in
  a quiet room and high MPM clarity.
- If the page simultaneously plays audio while capturing, playback stutters.
- The 20/19 compression suggests periodically dropped capture chunks (possibly
  related to the 20 ms capture callback vs 128-frame render quantum mismatch
  described in bug 253952).

**Expected results:** detected pitch ≈ 466 Hz, stable — which is exactly what
the SAME page produces in Chrome on the SAME machine, and in Safari on iOS
(iPhone), and what Safari/macOS itself achieves for playback (its output tone
is measured accurate by another device).

**Notes:** Reproducible 100% of the time on this machine. Happy to provide a
minimal standalone test page.
