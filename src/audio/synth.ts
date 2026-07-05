/**
 * Swara synthesizer: a soft, steady, voice-like sustained tone.
 * Additive harmonics through a gentle lowpass, with click-free attack/release.
 * No vibrato — this is a pitch reference; steadiness is the feature.
 *
 * Frequencies are computed by the caller (JI ratios × sruti); this module
 * only ever receives Hz. Nothing here depends on the device sample rate.
 *
 * startSwara() may be called while the context is still warming up (first
 * tap after launch, or after an external app took the audio session): the
 * note begins once the context is running, and every note sounds for at
 * least MIN_HOLD_S even if the finger lifted before audio came alive.
 */

import { ensureRunningContext } from './context';

const HARMONIC_GAINS = [1, 0.28, 0.14, 0.06, 0.03];
const ATTACK_S = 0.045;
const RELEASE_S = 0.22;
const MASTER_GAIN = 0.22;
/** Guaranteed audible length; also keeps release from landing mid-attack. */
const MIN_HOLD_S = 0.3;

export interface Voice {
  /** Begin a click-free release; resources are freed when it completes. */
  stop(): void;
}

export function startSwara(frequencyHz: number): Voice {
  let released = false;
  let releaseNow: (() => void) | null = null;

  void (async () => {
    const ctx = await ensureRunningContext();
    const startAt = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, startAt);
    master.gain.linearRampToValueAtTime(MASTER_GAIN, startAt + ATTACK_S);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = Math.min(frequencyHz * 6, 4000);
    lowpass.Q.value = 0.5;

    master.connect(lowpass);
    lowpass.connect(ctx.destination);

    const oscillators = HARMONIC_GAINS.map((gain, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequencyHz * (i + 1);
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(master);
      osc.start(startAt);
      return osc;
    });

    releaseNow = () => {
      // Never earlier than MIN_HOLD_S after onset: guarantees audibility and
      // that the release always begins after the attack ramp has finished.
      const t = Math.max(ctx.currentTime, startAt + MIN_HOLD_S);
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(MASTER_GAIN, t);
      master.gain.linearRampToValueAtTime(0, t + RELEASE_S);
      const end = t + RELEASE_S + 0.05;
      for (const osc of oscillators) osc.stop(end);
      // Disconnect after the tail so the graph is garbage-collected.
      oscillators[0].onended = () => {
        master.disconnect();
        lowpass.disconnect();
      };
    };

    // Finger already lifted while we were warming up — play the minimum note.
    if (released) releaseNow();
  })();

  return {
    stop() {
      if (released) return;
      released = true;
      releaseNow?.();
    },
  };
}
