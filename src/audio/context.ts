/**
 * Single shared AudioContext (ARCHITECTURE.md audio rule #1).
 * iOS requires creation/resume inside a user gesture — call getAudioContext()
 * only from event handlers.
 *
 * iOS specifics (ARCHITECTURE.md audio rule #8):
 * - The ring/silent hardware switch mutes Web Audio unless the audio session
 *   is declared as "playback" (media), so we set navigator.audioSession.type.
 * - A silent buffer is played on first unlock; iOS fully unlocks audio output
 *   only after something has actually been played inside a gesture.
 * - Another app taking the audio session leaves the context 'interrupted';
 *   resume() can wedge there, so ensureRunningContext() rebuilds a stuck
 *   context instead of requiring an app restart.
 */

declare global {
  interface Navigator {
    audioSession?: { type: string };
  }
}

let ctx: AudioContext | null = null;

/**
 * 'playback' plays through the iOS silent switch but is output-only —
 * getUserMedia fails under it ("AudioSession category is not compatible
 * with audio capture"). Switch to 'play-and-record' while the mic is on,
 * back to 'playback' when it stops.
 */
let currentSessionType: 'playback' | 'play-and-record' = 'playback';

export function setAudioSessionType(type: 'playback' | 'play-and-record'): void {
  currentSessionType = type;
  try {
    if (navigator.audioSession) {
      navigator.audioSession.type = type;
    }
  } catch {
    // Older platforms without the Audio Session API.
  }
}

/** Re-assert the CURRENT type (not blindly 'playback' — capture may be on). */
function declarePlaybackSession(): void {
  setAudioSessionType(currentSessionType);
}

/**
 * Close the shared context so no audio session is active — used before
 * switching the session category for capture, since a category set while a
 * session is already active may not be applied.
 */
export async function closeAudioContext(): Promise<void> {
  const old = ctx;
  ctx = null;
  if (old && old.state !== 'closed') {
    try {
      await old.close();
    } catch {
      // Already closing; ignore.
    }
  }
}

// Declare as early as possible, before any context exists.
declarePlaybackSession();

// Recover pre-emptively when returning from another app.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx && ctx.state !== 'running') {
      void ctx.resume().catch(() => {});
    }
  });
}

/** Synchronous create + resume attempt. MUST be called inside a user gesture. */
export function getAudioContext(): AudioContext {
  if (!ctx) {
    declarePlaybackSession();
    ctx = new AudioContext();
    // Silent one-sample buffer: completes the iOS unlock inside the gesture.
    const unlockBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = unlockBuffer;
    source.connect(ctx.destination);
    source.start(0);
  }
  if (ctx.state !== 'running') {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

function waitForRunning(c: AudioContext, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (c.state === 'running') return resolve(true);
    const timer = setTimeout(() => {
      c.removeEventListener('statechange', onChange);
      resolve(c.state === ('running' as AudioContextState));
    }, timeoutMs);
    const onChange = () => {
      if (c.state === 'running') {
        clearTimeout(timer);
        c.removeEventListener('statechange', onChange);
        resolve(true);
      }
    };
    c.addEventListener('statechange', onChange);
    void c.resume().catch(() => {});
  });
}

/**
 * Resolve with a RUNNING context. Call synchronously from a gesture handler
 * (the synchronous part performs the gesture-bound creation/unlock); if the
 * existing context is wedged in 'interrupted'/'suspended' (e.g. after an
 * external app took the audio session), it is closed and rebuilt.
 */
export async function ensureRunningContext(): Promise<AudioContext> {
  const first = getAudioContext();
  // Give iOS a real chance to activate the route — rebuilding too eagerly
  // costs more time than waiting (route activation can take ~1 s).
  if (await waitForRunning(first, 1000)) return first;

  // Stuck — rebuild. Cheap for us: the audio graph is per-note.
  try {
    await first.close();
  } catch {
    // Already closed or closing; ignore.
  }
  if (ctx === first) ctx = null;
  const rebuilt = getAudioContext();
  await waitForRunning(rebuilt, 700);
  return rebuilt;
}
