/**
 * Dev helper: objective stats for candidate SFX samples so we can pick hit/miss/UI sounds
 * without listening — duration, attack time, decay to −20 dB, spectral centroid (brightness).
 * Usage: tsx --tsconfig tsconfig.node.json scripts/analyze-samples.ts <dir> [nameFilterRegex]
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { decodePcm } from './ffmpeg';
import { RealFFT } from '../src/shared/lib/analysis/fft';

const RATE = 44100;
const dir = process.argv[2];
const filter = process.argv[3] ? new RegExp(process.argv[3], 'i') : null;
const fft = new RealFFT(2048);
const mags = new Float32Array(1025);

interface Stat {
  name: string;
  ms: number;
  attackMs: number;
  decayMs: number;
  centroidHz: number;
  peak: number;
}

const rows: Stat[] = [];
for (const name of readdirSync(dir).filter((f) => /\.(ogg|wav|mp3)$/i.test(f) && (!filter || filter.test(f)))) {
  const pcm = decodePcm(join(dir, name), RATE);
  let peak = 0;
  let peakIdx = 0;
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]);
    if (a > peak) {
      peak = a;
      peakIdx = i;
    }
  }
  if (peak === 0) continue;
  // Envelope via 5 ms RMS windows.
  const win = Math.round(RATE * 0.005);
  const env: number[] = [];
  for (let i = 0; i + win <= pcm.length; i += win) {
    let s = 0;
    for (let k = 0; k < win; k++) s += pcm[i + k] * pcm[i + k];
    env.push(Math.sqrt(s / win));
  }
  const envPeak = Math.max(...env);
  const envPeakIdx = env.indexOf(envPeak);
  let decayIdx = env.length - 1;
  for (let i = envPeakIdx; i < env.length; i++) {
    if (env[i] < envPeak * 0.1) {
      decayIdx = i;
      break;
    }
  }
  let endIdx = env.length - 1;
  for (let i = env.length - 1; i >= 0; i--) {
    if (env[i] > envPeak * 0.02) {
      endIdx = i;
      break;
    }
  }
  // Spectral centroid around the peak.
  const start = Math.max(0, Math.min(pcm.length - 2048, peakIdx - 256));
  fft.magnitudes(pcm.subarray(start, start + 2048), mags);
  let num = 0;
  let den = 0;
  for (let k = 1; k < mags.length; k++) {
    num += k * (RATE / 2048) * mags[k];
    den += mags[k];
  }
  rows.push({
    name,
    ms: Math.round(((endIdx + 1) * win * 1000) / RATE),
    attackMs: Math.round((envPeakIdx * win * 1000) / RATE),
    decayMs: Math.round(((decayIdx - envPeakIdx) * win * 1000) / RATE),
    centroidHz: Math.round(den ? num / den : 0),
    peak: Math.round(peak * 100) / 100,
  });
}

rows.sort((a, b) => a.name.localeCompare(b.name));
console.log('name'.padEnd(30), 'len ms', 'attack', 'decay', 'centroid', 'peak');
for (const r of rows) {
  console.log(r.name.padEnd(30), String(r.ms).padStart(6), String(r.attackMs).padStart(6), String(r.decayMs).padStart(5), String(r.centroidHz).padStart(8), String(r.peak).padStart(5));
}
