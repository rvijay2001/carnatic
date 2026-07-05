<script lang="ts">
  import { mayamalavagowla } from '../data/ragas';
  import { settings } from '../lib/settings';
  import { nearestSwara } from '../lib/tuner';
  import { srutiToHz, sthayiName } from '../lib/pitch';
  import { startMic, type MicSession } from '../audio/mic';
  import PitchTrace from './PitchTrace.svelte';

  // Gates are deliberately gentle: beginner singing is soft, and the median
  // + EMA smoothing below absorbs the extra noise the lower gates admit.
  // Hysteresis: entering voicing is stricter than staying in it, so soft
  // onsets register quickly (Mac-at-a-distance) without mid-note dropouts.
  const CLARITY_ENTER = 0.8;
  const CLARITY_STAY = 0.7;
  const RMS_GATE = 0.003;
  const HZ_MIN = 55;
  const HZ_MAX = 1400;
  /** Silence that ends a phrase and reveals its trace. */
  const PHRASE_END_MS = 1000;
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
  let level = $state(0);
  let lastReading: {
    label: string;
    sthayi: string;
    cents: number;
    hz: number;
  } | null = $state(null);
  let lastClarity = $state(0);

  let phraseActive = false;
  let phraseStartMs = 0;
  let lastVoicedMs = 0;
  let medianWindow: number[] = [];
  let ema: number | null = null;

  function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  function endPhrase() {
    if (!phraseActive) return;
    phraseActive = false;
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

    lastClarity = sample.clarity;
    const voiced =
      sample.clarity >= (singing ? CLARITY_STAY : CLARITY_ENTER) &&
      sample.rms >= RMS_GATE &&
      sample.hz >= HZ_MIN &&
      sample.hz <= HZ_MAX;

    if (voiced) {
      if (!phraseActive) {
        phraseActive = true;
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
          {singing
            ? 'Hearing you — the trace appears when you pause'
            : 'Listening — sing a swara'}
        </p>
      {/if}

      {#if $settings.tunerNumbers && lastReading}
        <p class="numbers">
          {lastReading.label} · {lastReading.sthayi} ·
          {lastReading.cents >= 0 ? '+' : ''}{lastReading.cents.toFixed(0)}¢ ·
          {lastReading.hz.toFixed(1)} Hz · clarity {(lastClarity * 100).toFixed(0)}%
        </p>
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
    <summary>Cross-device calibration check</summary>
    <ol>
      <li>On the other device, open Swaras and hold <strong>Sa</strong>.</li>
      <li>Point this device's microphone at it (enable "Numbers" here).</li>
      <li>This tuner must read <strong>Sa 0¢</strong> (±3¢). Repeat the other
        way around. Any disagreement between devices is a bug — report it.</li>
    </ol>
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

  .calibration ol {
    margin: 0.5rem 0 0;
    padding-left: 1.2rem;
  }
</style>
