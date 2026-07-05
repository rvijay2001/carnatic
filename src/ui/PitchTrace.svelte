<script lang="ts">
  import type { Raga } from '../data/ragas';
  import { ratioToCents } from '../lib/pitch';

  /**
   * Pitch-over-time trace: x = time, y = cents above the sruti's madhya Sa.
   * Swaras are fixed horizontal gridlines, so drifting into a neighboring
   * swara reads as the line approaching the next gridline — no re-anchoring.
   */
  interface Point {
    /** Seconds since phrase start. */
    t: number;
    /** Cents above madhya Sa, or null for an unvoiced gap. */
    c: number | null;
  }

  let {
    points,
    raga,
    windowSec = 8,
    live = false,
  }: { points: Point[]; raga: Raga; windowSec?: number; live?: boolean } = $props();

  const W = 340;
  const H = 220;
  const PAD_L = 44;
  const PAD_Y = 8;
  const PAD_B = 18;

  const voiced = $derived(points.filter((p) => p.c !== null) as { t: number; c: number }[]);

  const yRange = $derived.by(() => {
    if (voiced.length === 0) return { min: -150, max: 1350 };
    let min = Infinity;
    let max = -Infinity;
    for (const p of voiced) {
      if (p.c < min) min = p.c;
      if (p.c > max) max = p.c;
    }
    return { min: min - 90, max: max + 90 };
  });

  const xRange = $derived.by(() => {
    const tEnd = points.length ? points[points.length - 1].t : windowSec;
    const end = live ? Math.max(tEnd, windowSec) : tEnd;
    return { start: live ? end - windowSec : 0, end: Math.max(end, 0.5) };
  });

  function x(t: number): number {
    return PAD_L + ((t - xRange.start) / (xRange.end - xRange.start)) * (W - PAD_L - 4);
  }

  function y(c: number): number {
    return (
      H - PAD_B - ((c - yRange.min) / (yRange.max - yRange.min)) * (H - PAD_Y - PAD_B)
    );
  }

  /** Second ticks along the time axis — durations must be objective. */
  const ticks = $derived.by(() => {
    const span = xRange.end - xRange.start;
    const step = span <= 6 ? 1 : span <= 15 ? 2 : 5;
    const out: number[] = [];
    for (let t = Math.ceil(xRange.start / step) * step; t <= xRange.end; t += step) {
      out.push(t);
    }
    return out;
  });

  /** Swara gridlines (with sthayi dots) covering the visible cents range. */
  const gridlines = $derived.by(() => {
    const lines: { cents: number; label: string }[] = [];
    for (let oct = -2; oct <= 2; oct++) {
      for (const swara of raga.swaras) {
        const base = ratioToCents(swara.ratio);
        if (base >= 1200) continue; // tara Sa comes from the next octave's S
        const cents = base + 1200 * oct;
        if (cents < yRange.min || cents > yRange.max) continue;
        const mark = oct > 0 ? '˙'.repeat(oct) : oct < 0 ? '.'.repeat(-oct) : '';
        lines.push({ cents, label: swara.label + mark });
      }
    }
    return lines;
  });

  const path = $derived.by(() => {
    let d = '';
    let pen = false;
    for (const p of points) {
      if (p.c === null || p.t < xRange.start) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.c).toFixed(1)}`;
      pen = true;
    }
    return d;
  });
</script>

<svg viewBox="0 0 {W} {H}" class="trace" role="img" aria-label="Pitch over time">
  {#each gridlines as line (line.cents)}
    <!-- Guard bands: orange within ±25¢, green within ±10¢ of the target. -->
    <rect
      x={PAD_L}
      y={y(line.cents + 25)}
      width={W - PAD_L - 4}
      height={y(line.cents - 25) - y(line.cents + 25)}
      class="band near"
    />
    <rect
      x={PAD_L}
      y={y(line.cents + 10)}
      width={W - PAD_L - 4}
      height={y(line.cents - 10) - y(line.cents + 10)}
      class="band good"
    />
  {/each}
  {#each gridlines as line (line.cents)}
    <line
      x1={PAD_L}
      y1={y(line.cents)}
      x2={W - 4}
      y2={y(line.cents)}
      class="grid"
      class:sa={line.label.startsWith('Sa')}
    />
    <text x={PAD_L - 6} y={y(line.cents) + 3} class="grid-label" text-anchor="end">
      {line.label}
    </text>
  {/each}
  {#each ticks as t (t)}
    <line x1={x(t)} y1={PAD_Y} x2={x(t)} y2={H - PAD_B} class="tick" />
    <text x={x(t)} y={H - 5} class="grid-label" text-anchor="middle">{t}s</text>
  {/each}
  <path d={path} class="voice" />
</svg>

<style>
  .trace {
    width: 100%;
    height: auto;
    display: block;
  }

  .band.near {
    fill: #e0a458;
    opacity: 0.14;
  }

  .band.good {
    fill: #57c26d;
    opacity: 0.2;
  }

  .grid {
    stroke: var(--border);
    stroke-width: 1;
  }

  .grid.sa {
    stroke: var(--muted);
    stroke-width: 1.4;
  }

  .tick {
    stroke: var(--border);
    stroke-width: 1;
    opacity: 0.5;
    stroke-dasharray: 2 4;
  }

  .grid-label {
    fill: var(--muted);
    font-size: 10px;
  }

  .voice {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
</style>
