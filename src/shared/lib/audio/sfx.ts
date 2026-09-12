import { audioEngine } from './AudioEngine';
import { SampleBank } from './SampleBank';

/**
 * Sound effects: CC0 samples (Kenney packs, see public/music/LICENSES.md) played through a
 * SampleBank. If a sample failed to load, a minimal synthesised stand-in keeps the feedback
 * loop intact — the game never goes silent because of a 404.
 */
const SAMPLES = [
  'hit-0',
  'hit-1',
  'hit-2',
  'hit-3',
  'hit-4',
  'miss-0',
  'miss-1',
  'miss-2',
  'combo-break-0',
  'combo-break-1',
  'metronome',
  'metronome-accent',
  'milestone',
  'ui',
  'rank',
  'lanes-open',
  'lanes-close',
  'lanes-glitch',
  'swipe-0',
  'swipe-1',
] as const;

export const sfxBank = new SampleBank(`${import.meta.env.BASE_URL}sfx/`);

/** Call once after the AudioContext exists (first user gesture). Idempotent. */
export function preloadSfx(): Promise<void> {
  return sfxBank.load(SAMPLES);
}

/** Note hit; quality 0 = perfect, 1 = great, 2 = good. Softer + slightly lower for weaker hits. */
export function sfxHit(quality: 0 | 1 | 2, when?: number): void {
  const gain = [1, 0.8, 0.6][quality];
  const rate = [1, 0.96, 0.9][quality];
  if (!sfxBank.play('hit', { when, gain, rate })) fallbackTone(1200 * rate, 0.05, gain * 0.25, 'triangle', when);
}

/** Plain miss — a dull thud (the master lowpass duck does the rest). */
export function sfxMiss(): void {
  if (!sfxBank.play('miss', { gain: 0.9 })) fallbackTone(140, 0.18, 0.3, 'sine');
}

/** Losing a combo: glass shatters (GDD §1.1). */
export function sfxComboBreak(): void {
  if (!sfxBank.play('combo-break', { gain: 0.9 })) fallbackNoise(0.25);
}

/** Metronome click for calibration, scheduled on the audio clock. */
export function sfxClick(when: number, accent = false): void {
  if (!sfxBank.play(accent ? 'metronome-accent' : 'metronome', { when, gain: accent ? 1 : 0.8 })) {
    fallbackTone(accent ? 1800 : 1200, 0.04, 0.4, 'square', when);
  }
}

/** Combo milestone chime. */
export function sfxMilestone(): void {
  if (!sfxBank.play('milestone', { gain: 0.9 })) fallbackTone(880, 0.25, 0.15, 'sine');
}

/** Crystal collected: the milestone chime pitched up (big gems a touch lower and louder) — no extra sample. */
export function sfxGem(big = false): void {
  const rate = big ? 1.35 : 1.6;
  if (!sfxBank.play('milestone', { gain: big ? 1 : 0.8, rate })) fallbackTone(880 * rate, 0.2, 0.15, 'sine');
}

/** Rank reveal on the result screen. */
export function sfxRank(): void {
  if (!sfxBank.play('rank', { gain: 0.9 })) fallbackTone(660, 0.3, 0.15, 'sine');
}

/** Lane count changes: a rising "maximize" when lanes spread apart, a falling "minimize" when they merge, with a glitch accent on top. */
export function sfxLanes(open: boolean): void {
  const played = sfxBank.play(open ? 'lanes-open' : 'lanes-close', { gain: 1 });
  sfxBank.play('lanes-glitch', { gain: 0.45, rate: open ? 1.1 : 0.9 });
  if (!played) {
    const ctx = audioEngine.context;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(open ? 220 : 880, t);
    osc.frequency.exponentialRampToValueAtTime(open ? 880 : 220, t + 0.35);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(audioEngine.sfxDestination);
    osc.start(t);
    osc.stop(t + 0.42);
  }
}

/** A card passing the centre of the deck: a soft pluck, pitched up a little with each card of a long flight. */
export function sfxSwipe(pitch = 1): void {
  if (!sfxBank.play('swipe', { gain: 0.55, rate: pitch })) fallbackTone(520 * pitch, 0.05, 0.08, 'sine');
}

/** Soft UI click for buttons. */
export function sfxUi(): void {
  if (!sfxBank.play('ui', { gain: 0.7 })) fallbackTone(700, 0.06, 0.12, 'sine');
}

function fallbackTone(freq: number, dur: number, gainValue: number, type: OscillatorType, when?: number): void {
  const ctx = audioEngine.context;
  if (!ctx) return;
  const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(audioEngine.sfxDestination);
  osc.start(t);
  osc.stop(t + dur + 0.01);
}

function fallbackNoise(dur: number): void {
  const ctx = audioEngine.context;
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0.3;
  src.connect(gain).connect(audioEngine.sfxDestination);
  src.start();
}
