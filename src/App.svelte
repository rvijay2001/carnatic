<script lang="ts">
  import { NOTE_NAMES, srutiToHz, KATTAI } from './lib/pitch';
  import type { NoteName } from './lib/pitch';
  import { settings } from './lib/settings';
  import SwaraBoard from './ui/SwaraBoard.svelte';
  import Tuner from './ui/Tuner.svelte';

  const OCTAVES = [1, 2, 3, 4];
  // Sthayi labels anchored to the owner's voice: A#2 is his madhya-sthayi Sa
  // (user decision 2026-07), so octave 2 = Madhya.
  const OCTAVE_LABELS: Record<number, string> = {
    1: 'Mandra Sthayi',
    2: 'Madhya Sthayi',
    3: 'Tara Sthayi',
    4: 'Atitara Sthayi',
  };

  // In-app navigation only — never URL/hash routing (iOS PWAs re-prompt for
  // mic permission when the URL hash changes; see ARCHITECTURE.md).
  let view: 'swaras' | 'tuner' = $state('swaras');

  const saHz = $derived(srutiToHz($settings.sruti));
</script>

<main>
  <header>
    <div class="title-row">
      <h1>Carnatic</h1>
      <nav>
        <button class:current={view === 'swaras'} onclick={() => (view = 'swaras')}>
          Swaras
        </button>
        <button class:current={view === 'tuner'} onclick={() => (view = 'tuner')}>
          Tuner
        </button>
      </nav>
    </div>
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
          <option value={o}>{$settings.sruti.note}{o} · {OCTAVE_LABELS[o]}</option>
        {/each}
      </select>
    </label>
    <div class="sa-hz">Sa = {saHz.toFixed(1)} Hz</div>
  </section>

  {#if view === 'swaras'}
    <SwaraBoard />
  {:else}
    <Tuner />
  {/if}

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
    <p class="build">build {__BUILD_TIME__}</p>
  </footer>
</main>

<style>
  main {
    max-width: 30rem;
    margin: 0 auto;
    /* Top inset keeps the header below the iPhone status bar / notch. */
    padding: calc(0.75rem + env(safe-area-inset-top)) 1rem
      calc(1.5rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 100dvh;
  }

  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  header h1 {
    font-size: 1.4rem;
    margin: 0;
    letter-spacing: 0.02em;
  }

  nav {
    display: flex;
    gap: 0.4rem;
  }

  nav button {
    font: inherit;
    font-size: 0.9rem;
    padding: 0.4rem 0.9rem;
    border-radius: 0.6rem;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
  }

  nav button.current {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
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

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.3rem;
  }

  .hz-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .build {
    margin: 0;
    font-size: 0.7rem;
    color: var(--muted);
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }
</style>
