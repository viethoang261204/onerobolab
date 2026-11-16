import { useSettingsStore } from '../settings/settings-store';

export type SoundId =
  | 'click'
  | 'blockDrop'
  | 'blockConnect'
  | 'programStart'
  | 'programStop'
  | 'checkpoint'
  | 'collision'
  | 'missionComplete'
  | 'levelComplete';

/** One synthesized note: frequency (Hz), start offset and length (s), wave, peak gain. */
type Note = readonly [freq: number, at: number, dur: number, wave: OscillatorType, gain: number];

/**
 * Tiny, soft UI sounds generated with WebAudio (no asset files). Each entry
 * is a few short notes. Replace `SOUNDS` with sample playback later without
 * touching callers.
 */
const SOUNDS: Record<SoundId, readonly Note[]> = {
  click: [[880, 0, 0.04, 'sine', 0.05]],
  blockDrop: [[520, 0, 0.06, 'triangle', 0.07]],
  blockConnect: [
    [660, 0, 0.05, 'triangle', 0.07],
    [990, 0.04, 0.07, 'triangle', 0.06],
  ],
  programStart: [
    [523, 0, 0.08, 'sine', 0.08],
    [784, 0.07, 0.12, 'sine', 0.08],
  ],
  programStop: [
    [587, 0, 0.08, 'sine', 0.07],
    [392, 0.07, 0.12, 'sine', 0.07],
  ],
  checkpoint: [
    [784, 0, 0.08, 'sine', 0.09],
    [1175, 0.07, 0.16, 'sine', 0.08],
  ],
  collision: [
    [180, 0, 0.14, 'triangle', 0.12],
    [120, 0.05, 0.18, 'sine', 0.1],
  ],
  missionComplete: [
    [523, 0, 0.12, 'sine', 0.08],
    [659, 0.1, 0.12, 'sine', 0.08],
    [784, 0.2, 0.22, 'sine', 0.09],
  ],
  levelComplete: [
    [659, 0, 0.1, 'triangle', 0.07],
    [880, 0.09, 0.1, 'triangle', 0.07],
    [1319, 0.18, 0.3, 'sine', 0.07],
  ],
};

let ctx: AudioContext | null = null;
let lastPlayed: Partial<Record<SoundId, number>> = {};

function context(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
  ctx ??= new window.AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Sound effects gateway. Silent when sound is off, unsupported, or before any user gesture. */
export const AudioManager = {
  play(id: SoundId): void {
    const { sound, volume } = useSettingsStore.getState();
    if (!sound || volume <= 0) return;
    const now = performance.now();
    if (now - (lastPlayed[id] ?? 0) < 60) return; // de-duplicate bursts
    lastPlayed = { ...lastPlayed, [id]: now };
    try {
      const ac = context();
      if (!ac) return;
      const t0 = ac.currentTime + 0.005;
      for (const [freq, at, dur, wave, gain] of SOUNDS[id]) {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = wave;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, t0 + at);
        g.gain.linearRampToValueAtTime(gain * volume, t0 + at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        osc.connect(g).connect(ac.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + dur + 0.02);
      }
    } catch {
      // audio is optional
    }
  },
};
