/**
 * Dev helper: objective "how dynamic does it sound" metrics for every track in public/music,
 * used to curate the catalog (drop flat tracks, keep punchy ones).
 *   onsets/s       — attack density from the onset detector
 * beatConf         — share of tracked beats that land on an audible hit (rhythm clarity)
 *   LRA (LU)       — EBU R128 loudness range (dynamics), from ffmpeg ebur128
 *   crest          — peak/RMS ratio in dB (punchiness)
 *   brightness     — mean spectral centroid share above 2 kHz
 * Usage: tsx --tsconfig tsconfig.node.json scripts/analyze-tracks.ts [dir]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { FFMPEG, decodePcm } from './ffmpeg';
import { analyzeSong } from '../src/shared/lib/analysis';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const dir = process.argv[2] ? process.argv[2] : join(ROOT, 'public', 'music');
const RATE = 22050;

function loudnessRange(file: string): number {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const m = /LRA:\s+([\d.]+) LU/.exec(r.stderr);
  return m ? Number(m[1]) : 0;
}

const files = readdirSync(dir).filter((f) => /\.(mp3|ogg|wav)$/i.test(f));
const rows: Array<{ id: string; sec: number; nps: number; beatConf: number; lra: number; crest: number; bright: number; bpm: number }> = [];
for (const f of files) {
  const path = join(dir, f);
  const pcm = decodePcm(path, RATE);
  const a = analyzeSong(pcm, RATE);
  let peak = 0;
  let sq = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.abs(pcm[i]);
    if (v > peak) peak = v;
    sq += pcm[i] * pcm[i];
  }
  const rms = Math.sqrt(sq / pcm.length) || 1e-9;
  const onBeat = a.slots.filter((s) => s.step % 4 === 0);
  const beatConf = onBeat.filter((s) => s.strength >= 0.3).length / Math.max(1, onBeat.length);
  const bright = a.slots.reduce((acc, s) => acc + s.high, 0) / Math.max(1, a.slots.length);
  rows.push({ id: f.replace(/\.[^.]+$/, ''), sec: a.duration, nps: a.onsetCount / a.duration, beatConf, lra: loudnessRange(path), crest: 20 * Math.log10(peak / rms), bright, bpm: a.bpm });
}
// Composite "dynamic" score: density + rhythm clarity + loudness range, z-scored.
const z = (key: keyof (typeof rows)[0]) => {
  const v = rows.map((r) => r[key] as number);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length) || 1;
  return (r: (typeof rows)[0]) => ((r[key] as number) - mean) / sd;
};
const zn = z('nps');
const zb = z('beatConf');
const zl = z('lra');
const scored = rows.map((r) => ({ ...r, score: zn(r) + zb(r) + 0.5 * zl(r) })).sort((a, b) => b.score - a.score);
console.log('id'.padEnd(20), '  sec', '  bpm', 'ons/s', 'beat%', ' LRA', 'crest', 'bright', ' score');
for (const r of scored) {
  console.log(
    r.id.padEnd(20),
    String(Math.round(r.sec)).padStart(5),
    String(r.bpm).padStart(5),
    r.nps.toFixed(1).padStart(5),
    String(Math.round(r.beatConf * 100)).padStart(5),
    r.lra.toFixed(1).padStart(4),
    r.crest.toFixed(1).padStart(5),
    r.bright.toFixed(2).padStart(6),
    r.score.toFixed(2).padStart(6),
  );
}
const catalogPath = join(ROOT, 'src', 'entities', 'track', 'model', 'catalog.json');
try {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Array<{ id: string; title: string }>;
  console.log('\nlowest 4 by dynamics:', scored.slice(-4).map((r) => catalog.find((c) => c.id === r.id)?.title ?? r.id).join(' · '));
} catch {
  /* no catalog */
}
