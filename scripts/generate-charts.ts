/**
 * public/music/<id>.mp3 → public/charts/<id>.json + src/entities/track/model/catalog.json
 *
 * Runs the exact same analysis pipeline the browser uses for custom songs
 * (src/shared/lib/analysis) — the charts players get for their own MP3s are produced by the
 * same code that produced the built-in ones. World assignment is data-driven: tracks are
 * sorted by their Hard-chart star rating and split 4 / 4 / 4 / 4 across the worlds (GDD §3).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePcm, probeDuration } from './ffmpeg';
import { detectOnsets, estimateBpm, generateAllDifficulties } from '../src/shared/lib/analysis';
import type { ChartFile } from '../src/shared/types/chart';

interface RawTrack {
  id: string;
  title: string;
  artist: string;
  raw: string;
  sourceUrl: string;
  license: string;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MUSIC_DIR = join(ROOT, 'public', 'music');
const CHART_DIR = join(ROOT, 'public', 'charts');
const CATALOG = join(ROOT, 'src', 'entities', 'track', 'model', 'catalog.json');
const RATE = 22050;
const WORLD_IDS = ['launch', 'pulse', 'overload', 'core'] as const;

mkdirSync(CHART_DIR, { recursive: true });
const tracks = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'tracks.json'), 'utf8')) as RawTrack[];

interface Built {
  chart: ChartFile;
  hardStars: number;
}

const built: Built[] = [];
for (const t of tracks) {
  const file = join(MUSIC_DIR, `${t.id}.mp3`);
  const t0 = Date.now();
  const samples = decodePcm(file, RATE);
  const duration = probeDuration(file);
  const { onsets, flux, hopSeconds } = detectOnsets(samples, { sampleRate: RATE });
  const est = estimateBpm(flux, hopSeconds);
  const charts = generateAllDifficulties(onsets, est.bpm, est.offset, hash(t.id));
  const chart: ChartFile = {
    id: t.id,
    title: t.title,
    artist: t.artist,
    license: t.license,
    sourceUrl: t.sourceUrl,
    audio: `music/${t.id}.mp3`,
    bpm: est.bpm,
    offset: Math.round(est.offset * 1000) / 1000,
    duration: Math.round(duration * 100) / 100,
    charts,
  };
  writeFileSync(join(CHART_DIR, `${t.id}.json`), JSON.stringify(chart));
  built.push({ chart, hardStars: charts.hard.stars });
  const nps = (d: 'easy' | 'normal' | 'hard') => (charts[d].notes.length / duration).toFixed(1);
  console.log(
    `${t.id.padEnd(18)} ${duration.toFixed(0).padStart(4)}s  bpm ${est.bpm.toString().padStart(5)} (conf ${est.confidence.toFixed(2)})  onsets ${String(onsets.length).padStart(4)}  ` +
      `E ★${charts.easy.stars} ${nps('easy')}/s  N ★${charts.normal.stars} ${nps('normal')}/s  H ★${charts.hard.stars} ${nps('hard')}/s  ${Date.now() - t0} ms`,
  );
}

// World assignment by difficulty rank.
built.sort((a, b) => a.hardStars - b.hardStars || a.chart.charts.normal.stars - b.chart.charts.normal.stars || a.chart.bpm - b.chart.bpm);
const perWorld = Math.ceil(built.length / WORLD_IDS.length);
const catalog = built.map((b, i) => ({
  id: b.chart.id,
  title: b.chart.title,
  artist: b.chart.artist,
  license: b.chart.license,
  sourceUrl: b.chart.sourceUrl,
  world: WORLD_IDS[Math.min(WORLD_IDS.length - 1, Math.floor(i / perWorld))],
  bpm: b.chart.bpm,
  duration: b.chart.duration,
  stars: { easy: b.chart.charts.easy.stars, normal: b.chart.charts.normal.stars, hard: b.chart.charts.hard.stars },
  notes: { easy: b.chart.charts.easy.notes.length, normal: b.chart.charts.normal.notes.length, hard: b.chart.charts.hard.notes.length },
}));
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
console.log(`catalog.json: ${catalog.length} tracks`);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
