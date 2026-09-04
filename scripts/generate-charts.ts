/**
 * public/music/<id>.mp3 → public/charts/<id>.json + src/entities/track/model/catalog.json
 *
 * Runs the exact same analysis pipeline the browser uses for custom songs
 * (src/shared/lib/analysis): onsets → tempo → DP beat tracking → 16th grid → per-bar rhythm
 * templates → lane-count sections. World assignment is data-driven: tracks are sorted by their
 * Hard-chart star rating and split 4 / 4 / 4 / 4 across the worlds (GDD §3).
 *
 * Lane-count variation is "late game" content: world 1 keeps 4 lanes, world 2 varies on Hard,
 * worlds 3–4 vary on Normal and Hard. Easy never varies.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePcm, probeDuration } from './ffmpeg';
import { analyzeSong, generateAllDifficulties, type SongAnalysis } from '../src/shared/lib/analysis';
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
const LANE_VARIATION_BY_WORLD = [
  { normal: true, hard: true },
  { normal: true, hard: true },
  { normal: true, hard: true },
  { normal: true, hard: true },
] as const;

mkdirSync(CHART_DIR, { recursive: true });
const tracks = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'tracks.json'), 'utf8')) as RawTrack[];

interface Built {
  track: RawTrack;
  analysis: SongAnalysis;
  duration: number;
  chart: ChartFile;
}

// Pass 1: analyse and rate everything (with full variation) to decide the worlds.
const built: Built[] = [];
for (const t of tracks) {
  const file = join(MUSIC_DIR, `${t.id}.mp3`);
  const t0 = Date.now();
  const samples = decodePcm(file, RATE);
  const duration = probeDuration(file);
  const analysis = analyzeSong(samples, RATE);
  const charts = generateAllDifficulties(analysis, { seed: hash(t.id) });
  built.push({ track: t, analysis, duration, chart: makeChart(t, analysis, duration, charts) });
  console.log(`${t.id.padEnd(18)} analysed in ${Date.now() - t0} ms  (bpm ${analysis.bpm}, bars ${analysis.barCount}, hard ★${charts.hard.stars})`);
}
built.sort((a, b) => a.chart.charts.normal.stars - b.chart.charts.normal.stars || a.chart.charts.normal.notes.length - b.chart.charts.normal.notes.length || a.chart.bpm - b.chart.bpm);

// Pass 2: regenerate with the world's lane-variation policy and write everything out.
const perWorld = Math.ceil(built.length / WORLD_IDS.length);
const catalog = built.map((b, i) => {
  const worldIdx = Math.min(WORLD_IDS.length - 1, Math.floor(i / perWorld));
  const policy = LANE_VARIATION_BY_WORLD[worldIdx];
  const charts = generateAllDifficulties(b.analysis, { seed: hash(b.track.id), laneVariation: { easy: false, normal: policy.normal, hard: policy.hard } });
  const chart = makeChart(b.track, b.analysis, b.duration, charts);
  writeFileSync(join(CHART_DIR, `${b.track.id}.json`), JSON.stringify(chart));
  const info = (d: 'easy' | 'normal' | 'hard') => {
    const notes = charts[d].notes;
    const holds = notes.filter((n) => n.length >= 3 && (n[2] as number) > 0).length;
    const spells = notes.filter((n) => n.length === 4).length;
    const lanes = (charts[d].sections ?? [[0, 4]]).map((s) => s[1]).join('→');
    return `★${charts[d].stars} ${(notes.length / b.duration).toFixed(1)}/s h${holds} s${spells} [${lanes}]`;
  };
  console.log(`${WORLD_IDS[worldIdx].padEnd(9)} ${b.track.id.padEnd(18)} E ${info('easy')}  N ${info('normal')}  H ${info('hard')}`);
  return {
    id: chart.id,
    title: chart.title,
    artist: chart.artist,
    license: chart.license,
    sourceUrl: chart.sourceUrl,
    world: WORLD_IDS[worldIdx],
    bpm: chart.bpm,
    duration: chart.duration,
    stars: { easy: charts.easy.stars, normal: charts.normal.stars, hard: charts.hard.stars },
    notes: { easy: charts.easy.notes.length, normal: charts.normal.notes.length, hard: charts.hard.notes.length },
  };
});
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
console.log(`catalog.json: ${catalog.length} tracks`);

function makeChart(t: RawTrack, analysis: SongAnalysis, duration: number, charts: ChartFile['charts']): ChartFile {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    license: t.license,
    sourceUrl: t.sourceUrl,
    audio: `music/${t.id}.mp3`,
    bpm: analysis.bpm,
    offset: analysis.beats[0] ?? 0,
    duration: Math.round(duration * 100) / 100,
    beats: analysis.beats,
    charts,
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
