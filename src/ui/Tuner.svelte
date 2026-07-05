<script lang="ts">
  import { mayamalavagowla } from '../data/ragas';
  import { settings } from '../lib/settings';
  import { nearestSwara, type SwaraReading } from '../lib/tuner';
  import { sthayiName } from '../lib/pitch';
  import { startMic, type MicSession } from '../audio/mic';

  const CLARITY_GATE = 0.9;
  const RMS_GATE = 0.01;
  const HZ_MIN = 55;
  const HZ_MAX = 1400;
  /** Keep showing the last reading briefly through breaths/consonants. */
  const HOLD_MS = 800;

  let session: MicSession | null = $state(null);
  let starting = $state(false);
  let micError = $state('');
  let reading: SwaraReading | null = $state(null);
  let smoothedCents = $state(0);
  let lastVoicedAt = 0;

  async function toggle() {
    if (session) {
      session.stop();
      session = null;
      reading = null;
      return;
    }
    starting = true;
    micError = '';
    try {
      session = await startMic((sample) => {
        const voiced =
          sample.clarity >= CLARITY_GATE &&
          sample.rms >= RMS_GATE &&
          sample.hz >= HZ_MIN &&
          sample.hz <= HZ_MAX;
        if (voiced) {
          const next = nearestSwara(sample.hz, $settings.sruti, mayamalavagowla);
          if (next) {
            smoothedCents =
              reading && reading.swaraId === next.swaraId
                ? smoothedCents * 0.6 + next.centsOff * 0.4
                : next.centsOff;
            reading = next;
            lastVoicedAt = performance.now();
          }
        } else if (reading && performance.now() - lastVoicedAt > HOLD_MS) {
          reading = null;
        }
      });
    } catch (err) {
      micError =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow it in Settings and try again.'
          : `Could not start the microphone: ${err instanceof Error ? err.message : err}`;
    } finally {
      starting = false;
    }
  }

  const centsClamped = $derived(Math.max(-50, Math.min(50, smoothedCents)));
  const centsQuality = $derived(
    Math.abs(smoothedCents) <= 10 ? 'good' : Math.abs(smoothedCents) <= 25 ? 'near' : 'far',
  );
  const octaveMark = $derived.by(() => {
    const r = reading;
    if (!r || r.octaveOffset === 0) return '';
    return r.octaveOffset > 0 ? '˙' : '.';
  });
</script>

<section class="tuner" aria-label="Tuner">
  {#if session}
    <div class="display" class:silent={!reading}>
      {#if reading}
        <div class="swara-name {centsQuality}">
          {reading.label}<span class="octave">{octaveMark}</span>
        </div>
        <div class="sthayi">{sthayiName(reading.octaveOffset)}</div>
        <div class="meter" aria-label="Cents deviation">
          <div class="scale">
            <span>-50¢</span><span>0</span><span>+50¢</span>
          </div>
          <div class="track">
            <div class="center-line"></div>
            <div
              class="needle {centsQuality}"
              style="left: {50 + centsClamped}%"
            ></div>
          </div>
          <div class="cents-value {centsQuality}">
            {smoothedCents >= 0 ? '+' : ''}{smoothedCents.toFixed(0)}¢
          </div>
        </div>
        <div class="hz">{reading.hz.toFixed(1)} Hz</div>
      {:else}
        <div class="listening">Listening… sing a swara</div>
      {/if}
    </div>
  {:else}
    <p class="explain">
      Sing (or play a swara from the other device) and see which swara it is
      and how many cents you are from the just-intonation target.
    </p>
  {/if}

  {#if micError}
    <p class="error">{micError}</p>
  {/if}

  <button class="mic-toggle" onclick={toggle} disabled={starting}>
    {session ? 'Stop listening' : starting ? 'Starting…' : 'Start listening'}
  </button>

  <details class="calibration">
    <summary>Cross-device calibration check</summary>
    <ol>
      <li>On the other device, open Swaras and hold <strong>Sa</strong>.</li>
      <li>Point this device's microphone at it.</li>
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
    gap: 0.9rem;
    padding: 1.5rem 1rem;
    border-radius: 0.9rem;
    border: 1px solid var(--border);
    background: var(--surface);
    min-height: 14rem;
    justify-content: center;
  }

  .swara-name {
    font-size: 4rem;
    font-weight: 700;
    line-height: 1;
  }

  .swara-name .octave {
    font-size: 2rem;
    vertical-align: super;
  }

  .sthayi {
    color: var(--muted);
    font-size: 0.85rem;
    margin-top: -0.5rem;
  }

  .good { color: #57c26d; }
  .near { color: var(--accent); }
  .far { color: #d4646c; }

  .meter {
    width: 100%;
    max-width: 22rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .scale {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--muted);
  }

  .track {
    position: relative;
    height: 0.9rem;
    border-radius: 0.45rem;
    background: var(--bg);
    border: 1px solid var(--border);
    overflow: hidden;
  }

  .center-line {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--muted);
    opacity: 0.6;
  }

  .needle {
    position: absolute;
    top: 1px;
    bottom: 1px;
    width: 0.55rem;
    margin-left: -0.275rem;
    border-radius: 0.3rem;
    background: currentColor;
    transition: left 80ms linear;
  }

  .cents-value {
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .hz {
    color: var(--muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }

  .listening {
    color: var(--muted);
    font-size: 1rem;
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
