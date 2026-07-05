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
 */

declare global {
  interface Navigator {
    audioSession?: { type: string };
  }
}

let ctx: AudioContext | null = null;

function declarePlaybackSession(): void {
  try {
    if (navigator.audioSession) {
      navigator.audioSession.type = 'playback';
    }
  } catch {
    // Older iOS without the Audio Session API — the silent switch will
    // unfortunately mute the app there.
  }
}

// Declare as early as possible, before any context exists.
declarePlaybackSession();

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
  // iOS can leave the context 'suspended' or 'interrupted' (after calls,
  // Siri, app switches) — always try to resume from within the gesture.
  if (ctx.state !== 'running') {
    void ctx.resume();
  }
  return ctx;
}
