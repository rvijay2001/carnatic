<script lang="ts">
  import { mayamalavagowla } from './data/ragas';
  import { NOTE_NAMES, srutiToHz, swaraHz, ratioToCents, KATTAI } from './lib/pitch';
  import type { NoteName } from './lib/pitch';
  import { settings } from './lib/settings';
  import { startSwara, type Voice } from './audio/synth';

  const OCTAVES = [1, 2, 3, 4];

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

  const saHz = $derived(srutiToHz($settings.sruti));
</script>

<main>
  <header>
    <h1>Carnatic</h1>
    <p class="subtitle">{mayamalavagowla.name} · swara reference</p>
  </header>

  <section class="sruti" aria-label="Sruti">
    <label>
      <span>Sruti</span>
      <select
        value={$settings.sruti.note}
        onchange={(e) =>
          settings.update((s) => ({
            ...s,
            sruti: { ...s.sruti, note: e.currentTarget.value as NoteName },
          }))}
      >
        {#each NOTE_NAMES as note}
          <option value={note}>{note} · {KATTAI[note]} kattai</option>
        {/each}
      </select>
    </label>
    <label>
      <span>Octave</span>
      <select
        value={$settings.sruti.octave}
        onchange={(e) =>
          settings.update((s) => ({
            ...s,
            sruti: { ...s.sruti, octave: Number(e.currentTarget.value) },
          }))}
      >
        {#each OCTAVES as o}
          <option value={o}>{o}</option>
        {/each}
      </select>
    </label>
    <div class="sa-hz">Sa = {saHz.toFixed(1)} Hz</div>
  </section>

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

  <footer>
    <label class="hz-toggle">
      <input
        type="checkbox"
        checked={$settings.showHz}
        onchange={(e) =>
          settings.update((s) => ({ ...s, showHz: e.currentTarget.checked }))}
      />
      Show frequencies
    </label>
    <p class="hint">Hold a swara to sustain it. Just intonation over your sruti.</p>
  </footer>
</main>

<style>
  main {
    max-width: 30rem;
    margin: 0 auto;
    padding: 1rem 1rem calc(1.5rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 100dvh;
  }

  header h1 {
    font-size: 1.4rem;
    margin: 0;
    letter-spacing: 0.02em;
  }

  .subtitle {
    margin: 0.1rem 0 0;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .sruti {
    display: flex;
    align-items: end;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .sruti label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: var(--muted);
  }

  .sruti select {
    font-size: 1rem;
    padding: 0.45rem 0.5rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
  }

  .sa-hz {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    font-size: 0.9rem;
    padding-bottom: 0.5rem;
  }

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

  footer {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .hz-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>
