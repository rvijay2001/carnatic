<script lang="ts">
  import { mayamalavagowla } from '../data/ragas';
  import { settings } from '../lib/settings';
  import { nearestSwara } from '../lib/tuner';
  import { srutiToHz, sthayiName } from '../lib/pitch';
  import { startMic, type MicSession } from '../audio/mic';
  import { startSwara } from '../audio/synth';
  import { correctionCents, inferCorrection } from '../lib/calibrate';
  import PitchTrace from './PitchTrace.svelte';

  // Voicing is decided by CLARITY, not loudness: macOS Safari ignores
  // autoGainControl:false and ramps mic gain up over the first seconds
  // (~12 dB, measured on-device 2026-07), so any tight absolute-level gate
  // silently swallows the start of every phrase on the Mac. The level gate
  // is only a floor against a silent room.
  // Hysteresis: entering voicing is stricter than staying in it.
  const CLARITY_ENTER = 0.8;
  const CLARITY_STAY = 0.7;
  const RMS_GATE = 0.0005;
  // EXPERIMENT (revert tag: tuner-stable-1): reject steady machine hum
  // (furnace) by requiring living-voice pitch jitter. A human voice always
  // wobbles by several cents (breath pressure); machinery holds fractions
  // of a cent. Level thresholds cannot separate them (macOS AGC makes
  // post-ramp hum louder than pre-ramp voice — measured 2026-07).
  const JITTER_WINDOW = 8; // ~0.4 s of samples
  const JITTER_MIN_SAMPLES = 5; // ~0.25 s before voicing can begin
  const JITTER_MIN_CENTS = 1.5;
  const HZ_MIN = 55;
  const HZ_MAX = 1400;
  /**
   * Silence that ends a phrase and reveals its trace. Must sit comfortably
   * above a breath (0.5–1.5 s), or catching a breath kills the take.
   */
  const PHRASE_END_MS = 2500;
  const MAX_POINTS = 600; // ~30 s at 50 ms/sample

  interface Point {
    t: number;
    c: number | null;
  }

  let session: MicSession | null = $state(null);
  let starting = $state(false);
  let micError = $state('');

  let points: Point[] = $state([]);
  let lastPhrase: Point[] | null = $state(null);
  let singing = $state(false);
  /** Phrase is alive (survives breath gaps) — drives the caption. */
  let phraseOn = $state(false);
  let level = $state(0);
  let lastReading: {
    label: string;
    sthayi: string;
    cents: number;
    hz: number;
  } | null = $state(null);
  let lastRaw = $state({ hz: 0, clarity: 0, rms: 0 });

  let phraseActive = false;
  let phraseStartMs = 0;
  let lastVoicedMs = 0;
  let medianWindow: number[] = [];
  let ema: number | null = null;
  let jitterWindow: number[] = [];

  function stddev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const varSum = values.reduce((a, b) => a + (b - mean) ** 2, 0);
    return Math.sqrt(varSum / values.length);
  }

  function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  function endPhrase() {
    if (!phraseActive) return;
    phraseActive = false;
    phraseOn = false;
    singing = false;
    let end = points.length;
    while (end > 0 && points[end - 1].c === null) end--;
    lastPhrase = points.slice(0, end);
    points = [];
    // One phrase per listen: release the mic as soon as the pause is
    // detected so the button state and the OS mic indicator follow suit.
    if (session) {
      session.stop();
      session = null;
    }
  }

  function onSample(sample: { hz: number; clarity: number; rms: number }) {
    const now = performance.now();
    level = sample.rms;

    lastRaw = sample;
    const tonal =
      sample.clarity >= CLARITY_STAY &&
      sample.rms >= RMS_GATE &&
      sample.hz >= HZ_MIN &&
      sample.hz <= HZ_MAX;

    // Track raw pitch of tonal samples; a machine hum fills this window
    // with near-identical values, a voice never does.
    if (tonal) {
      jitterWindow.push(1200 * Math.log2(sample.hz / srutiToHz($settings.sruti)));
      if (jitterWindow.length > JITTER_WINDOW) jitterWindow.shift();
    } else {
      jitterWindow = [];
    }
    const livingVoice =
      jitterWindow.length >= JITTER_MIN_SAMPLES &&
      stddev(jitterWindow) >= JITTER_MIN_CENTS;

    const voiced =
      tonal &&
      livingVoice &&
      sample.clarity >= (singing ? CLARITY_STAY : CLARITY_ENTER);

    if (voiced) {
      if (!phraseActive) {
        phraseActive = true;
        phraseOn = true;
        phraseStartMs = now;
        medianWindow = [];
        ema = null;
        lastPhrase = null;
        points = [];
      }
      singing = true;
      lastVoicedMs = now;

      const cents = 1200 * Math.log2(sample.hz / srutiToHz($settings.sruti));
      medianWindow.push(cents);
      if (medianWindow.length > 5) medianWindow.shift();
      const med = median(medianWindow);
      ema = ema === null ? med : ema * 0.7 + med * 0.3;

      points.push({ t: (now - phraseStartMs) / 1000, c: ema });
      if (points.length > MAX_POINTS) points.shift();
      points = points;

      const reading = nearestSwara(sample.hz, $settings.sruti, mayamalavagowla);
      if (reading) {
        lastReading = {
          label: reading.label,
          sthayi: sthayiName(reading.octaveOffset),
          cents: reading.centsOff,
          hz: sample.hz,
        };
      }
    } else if (phraseActive) {
      if (now - lastVoicedMs > PHRASE_END_MS) {
        endPhrase();
      } else {
        points.push({ t: (now - phraseStartMs) / 1000, c: null });
        points = points;
        if (now - lastVoicedMs > 300) singing = false;
      }
    }
  }

  async function toggle() {
    if (session) {
      const s = session;
      session = null;
      s.stop();
      endPhrase();
      singing = false;
      return;
    }
    starting = true;
    micError = '';
    try {
      session = await startMic(onSample);
    } catch (err) {
      micError =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow it in Settings and try again.'
          : `Could not start the microphone: ${err instanceof Error ? err.message : err} (build ${__BUILD_TIME__})`;
    } finally {
      starting = false;
    }
  }

  const showLive = $derived($settings.tunerLiveTrace);
  const pulseScale = $derived(Math.min(1, level * 25));

  let calibrating = $state(false);
  let calMsg = $state('');

  /**
   * Loopback self-calibration: play our own Sa, listen with RAW (uncorrected)
   * readings, and snap the measured/true ratio to a known hardware ratio.
   * Detects the WebKit capture-rate mismatch (Mac read +147¢, 2026-07).
   */
  async function calibrate() {
    if (session) {
      const s = session;
      session = null;
      s.stop();
      endPhrase();
    }
    calibrating = true;
    calMsg = 'Playing Sa and listening to it…';
    const collected: number[] = [];
    let sess: MicSession | null = null;
    let voice: ReturnType<typeof startSwara> | null = null;
    try {
      sess = await startMic(
        (s) => {
          if (s.clarity >= 0.85 && s.rms >= 0.0005 && s.hz > 40 && s.hz < 3000) {
            collected.push(s.hz);
          }
        },
        { raw: true },
      );
      voice = startSwara(srutiToHz($settings.sruti));
      await new Promise((r) => setTimeout(r, 1800));
    } catch (err) {
      calMsg = `Calibration failed: ${err instanceof Error ? err.message : err}`;
      calibrating = false;
      voice?.stop();
      sess?.stop();
      return;
    }
    voice.stop();
    sess.stop();

    // Drop the first ~0.6 s (gain ramp, attack); judge the settled tone.
    const settled = collected.slice(Math.min(12, Math.floor(collected.length / 2)));
    if (settled.length < 8) {
      calMsg =
        'Could not hear the tone — raise the volume, unplug headphones, and try again.';
    } else {
      const measured = median(settled);
      const corr = inferCorrection(measured, srutiToHz($settings.sruti));
      if (!corr) {
        calMsg = `Ambiguous reading (${measured.toFixed(1)} Hz) — try again in a quieter moment.`;
      } else {
        settings.update((s) => ({
          ...s,
          pitchCorrection: corr.factor,
          pitchCorrectionLabel: corr.label,
        }));
        calMsg =
          corr.factor === 1
            ? 'This device reads pitch accurately — no correction needed.'
            : `Mismatch found (${corr.label}) — readings now corrected by ${(-correctionCents(corr.factor)).toFixed(0)}¢.`;
      }
    }
    calibrating = false;
  }
</script>

<section class="tuner" aria-label="Tuner">
  {#if session}
    <div class="display">
      {#if showLive && points.length > 0}
        <PitchTrace points={points} raga={mayamalavagowla} live={true} />
        <p class="caption">Live</p>
      {:else}
        <div class="pulse-wrap" aria-label="Microphone level">
          <div class="pulse" style="transform: scale({0.35 + pulseScale})"></div>
        </div>
        <p class="caption">
          {phraseOn
            ? 'Hearing you — breathe freely; pause a bit longer to finish'
            : 'Listening — sing a swara'}
        </p>
      {/if}

      {#if $settings.tunerNumbers}
        <!-- Raw gate inputs, shown continuously — the diagnostic view of
             exactly what the voicing gate accepts or rejects. -->
        <p class="numbers">
          raw {lastRaw.hz > 0 && lastRaw.hz < 10000 ? lastRaw.hz.toFixed(1) : '—'} Hz ·
          clarity {(lastRaw.clarity * 100).toFixed(0)}% ·
          level {(lastRaw.rms * 1000).toFixed(1)}
        </p>
        {#if lastReading}
          <p class="numbers">
            {lastReading.label} · {lastReading.sthayi} ·
            {lastReading.cents >= 0 ? '+' : ''}{lastReading.cents.toFixed(0)}¢
          </p>
        {/if}
      {/if}
    </div>
  {:else if lastPhrase}
    <div class="display">
      <PitchTrace points={lastPhrase} raga={mayamalavagowla} />
      <p class="caption">Your last phrase</p>
    </div>
  {:else}
    <p class="explain">
      Sing, then pause — you'll see how your pitch moved across the swara
      lines. No live meter by default: listen to your voice, not the screen.
    </p>
  {/if}

  {#if micError}
    <p class="error">{micError}</p>
  {/if}

  <button class="mic-toggle" onclick={toggle} disabled={starting}>
    {session ? 'Stop listening' : starting ? 'Starting…' : 'Start listening'}
  </button>

  <div class="options">
    <label>
      <input
        type="checkbox"
        checked={$settings.tunerLiveTrace}
        onchange={(e) =>
          settings.update((s) => ({ ...s, tunerLiveTrace: e.currentTarget.checked }))}
      />
      Live trace while singing
    </label>
    <label>
      <input
        type="checkbox"
        checked={$settings.tunerNumbers}
        onchange={(e) =>
          settings.update((s) => ({ ...s, tunerNumbers: e.currentTarget.checked }))}
      />
      Numbers (Hz / cents)
    </label>
  </div>

  <details class="calibration">
    <summary>Calibration</summary>
    <div class="cal-body">
      <button class="cal-btn" onclick={calibrate} disabled={calibrating || starting}>
        {calibrating ? 'Calibrating…' : 'Auto-calibrate this device (plays Sa)'}
      </button>
      {#if calMsg}
        <p class="cal-msg">{calMsg}</p>
      {/if}
      {#if $settings.pitchCorrection !== 1}
        <p class="cal-msg">
          Active correction: {(-correctionCents($settings.pitchCorrection)).toFixed(0)}¢
          ({$settings.pitchCorrectionLabel})
          <button
            class="cal-clear"
            onclick={() =>
              settings.update((s) => ({
                ...s,
                pitchCorrection: 1,
                pitchCorrectionLabel: '',
              }))}
          >
            clear
          </button>
        </p>
      {/if}
      <p class="cal-msg">
        Cross-device check: hold Sa on the other device's Swaras board; this
        tuner (Numbers on) must read Sa within a few cents.
      </p>
    </div>
  </details>
</section>

<style>
  .tuner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
  }

  .display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 1rem;
    border-radius: 0.9rem;
    border: 1px solid var(--border);
    background: var(--surface);
    min-height: 15rem;
    justify-content: center;
  }

  .pulse-wrap {
    height: 8rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pulse {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.75;
    transition: transform 90ms ease-out;
  }

  .caption {
    margin: 0;
    color: var(--muted);
    font-size: 0.8rem;
    text-align: center;
  }

  .numbers {
    margin: 0;
    color: var(--text);
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }

  .explain {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .error {
    margin: 0;
    color: #d4646c;
    font-size: 0.85rem;
  }

  .mic-toggle {
    font: inherit;
    font-weight: 600;
    padding: 0.8rem;
    border-radius: 0.9rem;
    border: 1px solid var(--border);
    background: var(--accent);
    color: var(--accent-text);
    cursor: pointer;
  }

  .mic-toggle:disabled {
    opacity: 0.6;
  }

  .options {
    display: flex;
    gap: 1.2rem;
    flex-wrap: wrap;
  }

  .options label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .calibration {
    font-size: 0.85rem;
    color: var(--muted);
  }

  .calibration summary {
    cursor: pointer;
  }

  .cal-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .cal-btn {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.5rem 0.8rem;
    border-radius: 0.6rem;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    align-self: flex-start;
  }

  .cal-btn:disabled {
    opacity: 0.6;
  }

  .cal-msg {
    margin: 0;
    font-size: 0.8rem;
  }

  .cal-clear {
    font: inherit;
    font-size: 0.75rem;
    padding: 0.1rem 0.5rem;
    margin-left: 0.4rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
</style>
