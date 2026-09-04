import { audioEngine } from './AudioEngine';

/**
 * Synthesised sound effects — zero assets, zero network.
 * Every effect is a short oscillator/noise burst scheduled on the audio clock.
 */
function ctxAndDest(): [AudioContext, AudioNode] | null {
  const ctx = audioEngine.context;
  if (!ctx) return null;
  return [ctx, audioEngine.sfxDestination];
}

let noiseBuffer: AudioBuffer | null = null;
function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.3);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

/** Short clean tick on a hit; pitch varies with judgement quality. */
export function sfxHit(quality: 0 | 1 | 2, when?: number): void {
  const pair = ctxAndDest();
  if (!pair) return;
  const [ctx, dest] = pair;
  const t = when ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = [1400, 1100, 900][quality];
  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + 0.07);
}

/** "Glass" break on a miss / combo loss: noise burst through a falling filter. */
export function sfxMiss(): void {
  const pair = ctxAndDest();
  if (!pair) return;
  const [ctx, dest] = pair;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(2600, t);
  filter.frequency.exponentialRampToValueAtTime(300, t + 0.22);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  src.connect(filter).connect(gain).connect(dest);
  src.start(t);
  src.stop(t + 0.26);
}

/** Metronome click for the calibration screen. `accent` marks the downbeat. */
export function sfxClick(when: number, accent = false): void {
  const pair = ctxAndDest();
  if (!pair) return;
  const [ctx, dest] = pair;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = accent ? 1800 : 1200;
  gain.gain.setValueAtTime(0.4, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
  osc.connect(gain).connect(dest);
  osc.start(when);
  osc.stop(when + 0.05);
}

/** Rising sweep for combo milestones. */
export function sfxMilestone(): void {
  const pair = ctxAndDest();
  if (!pair) return;
  const [ctx, dest] = pair;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(1600, t + 0.25);
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + 0.32);
}

/** Soft UI blip for buttons. */
export function sfxUi(): void {
  const pair = ctxAndDest();
  if (!pair) return;
  const [ctx, dest] = pair;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.exponentialRampToValueAtTime(990, t + 0.08);
  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + 0.11);
}
