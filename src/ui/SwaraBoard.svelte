<script lang="ts">
  import { mayamalavagowla } from '../data/ragas';
  import { swaraHz, ratioToCents } from '../lib/pitch';
  import { settings } from '../lib/settings';
  import { startSwara, type Voice } from '../audio/synth';

  // One voice per active pointer, so Sa + Pa can sound together.
  const voices = new Map<number, Voice>();
  let activeSwaras = $state(new Set<string>());

  function press(event: PointerEvent, swaraId: string, hz: number) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    voices.get(event.pointerId)?.stop();
    voices.set(event.pointerId, startSwara(hz));
    activeSwaras.add(swaraId);
    activeSwaras = new Set(activeSwaras);
  }

  function release(event: PointerEvent, swaraId: string) {
    const voice = voices.get(event.pointerId);
    if (voice) {
      voice.stop();
      voices.delete(event.pointerId);
    }
    activeSwaras.delete(swaraId);
    activeSwaras = new Set(activeSwaras);
  }
</script>

<section class="board" aria-label="Swara board">
  {#each mayamalavagowla.swaras as swara (swara.id)}
    {@const hz = swaraHz($settings.sruti, swara.ratio)}
    <button
      class="swara"
      class:active={activeSwaras.has(swara.id)}
      onpointerdown={(e) => press(e, swara.id, hz)}
      onpointerup={(e) => release(e, swara.id)}
      onpointercancel={(e) => release(e, swara.id)}
      oncontextmenu={(e) => e.preventDefault()}
    >
      <span class="label">{swara.label}</span>
      <span class="name">{swara.name}</span>
      {#if $settings.showHz}
        <span class="detail">
          {hz.toFixed(1)} Hz · {Math.round(ratioToCents(swara.ratio))}¢
        </span>
      {/if}
    </button>
  {/each}
</section>

<p class="hint">Hold a swara to sustain it. Just intonation over your sruti.</p>

<style>
  .board {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
    flex: 1;
  }

  .swara {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    min-height: 5.2rem;
    border-radius: 0.9rem;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    cursor: pointer;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: background 120ms ease, transform 120ms ease;
  }

  .swara.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
    transform: scale(0.985);
  }

  .swara .label {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .swara .name {
    font-size: 0.72rem;
    color: var(--muted);
  }

  .swara.active .name,
  .swara.active .detail {
    color: var(--accent-text);
    opacity: 0.85;
  }

  .swara .detail {
    font-size: 0.72rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .hint {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>
