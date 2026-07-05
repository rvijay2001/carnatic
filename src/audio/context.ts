/**
 * Single shared AudioContext (ARCHITECTURE.md audio rule #1).
 * iOS requires creation/resume inside a user gesture — call getAudioContext()
 * only from event handlers.
 */

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}
