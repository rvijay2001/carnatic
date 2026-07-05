/**
 * Swara synthesizer: a soft, steady, voice-like sustained tone.
 * Additive harmonics through a gentle lowpass, with click-free attack/release.
 * No vibrato — this is a pitch reference; steadiness is the feature.
 *
 * Frequencies are computed by the caller (JI ratios × sruti); this module
 * only ever receives Hz. Nothing here depends on the device sample rate.
 */

import { getAudioContext } from './context';

const HARMONIC_GAINS = [1, 0.28, 0.14, 0.06, 0.03];
const ATTACK_S = 0.045;
const RELEASE_S = 0.22;
const MASTER_GAIN = 0.22;

export interface Voice {
  /** Begin a click-free release; resources are freed when it completes. */
  stop(): void;
}

export function startSwara(frequencyHz: number): Voice {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(MASTER_GAIN, now + ATTACK_S);

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
    osc.start(now);
    return osc;
  });

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + RELEASE_S);
      const end = t + RELEASE_S + 0.05;
      for (const osc of oscillators) osc.stop(end);
      // Disconnect after the tail so the graph is garbage-collected.
      oscillators[0].onended = () => {
        master.disconnect();
        lowpass.disconnect();
      };
    },
  };
}
