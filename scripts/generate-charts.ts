/**
 * public/music/<id>.mp3 → public/charts/<id>.json + src/entities/track/model/catalog.json
 *
 * Runs the exact same analysis pipeline the browser uses for custom songs
 * (src/shared/lib/analysis): onsets → tempo → DP beat tracking → 16th grid → per-bar rhythm
 * templates → holds / slides / rolls / circle windows / lane-count sections. One chart per song;
 * the catalog is sorted easiest-first by the chart's star rating. The BEGINNER_TRACKS calmest
 * songs (by their normal rating) are re-read with the EASY profile so chapter one is a real
 * on-ramp: beats only, no rolls / slides / chords, 3–4 lanes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePcm, probeDuration } from './ffmpeg';
import {
  EASY,
  LAYERS,
  MEDIUM,
  analyzeSong,
  chartFeatures,
  composeChart,
  layerEnergy,
  layerStrengths,
  type LayerStrengths,
  type Profile,
  type StemLayers,
} from '../src/shared/lib/analysis';
import { GENRES, type ChartFile, type Genre } from '../src/shared/types/chart';

interface RawTrack {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  /** Premium track (shop item, paid with crystals) — copied into the chart file and the catalog. */
  premium?: boolean;
  /** Named pack (`rock`): its tracks sit together after the main catalog as a chapter of their own. */
  pack?: string;
  raw: string;
  sourceUrl: string;
  license: string;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** Picture cover made by `npm run assets:covers` — recorded in the catalog so the app knows to show it. */
const coverFile = (id: string): string | undefined => (existsSync(join(ROOT, 'public', 'covers', `${id}.webp`)) ? `covers/${id}.webp` : undefined);
const MUSIC_DIR = join(ROOT, 'public', 'music');
const CHART_DIR = join(ROOT, 'public', 'charts');
const CATALOG = join(ROOT, 'src', 'entities', 'track', 'model', 'catalog.json');
/** Raw Demucs output (stem-{drums,bass,other,vocals}.mp3): the chart follows these instruments; never shipped. */
const STEMS_SRC = process.env.STEMS_DIR ?? 'D:/neon-tap-tools/stems';
const RATE = 22050;
/** The calmest songs get the beginner reading (chapter one), the next ones the medium reading (chapter two). */
const BEGINNER_TRACKS = 10;
const MEDIUM_TRACKS = 10;

mkdirSync(CHART_DIR, { recursive: true });
const tracks = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'tracks.json'), 'utf8')) as RawTrack[];

interface Analysed {
  t: RawTrack;
  duration: number;
  analysis: ReturnType<typeof analyzeSong>;
  layers?: StemLayers;
  ms: number;
}
/** Onset strengths of every separated instrument on the mix's grid; undefined when the track has no stems yet. */
function loadLayers(id: string, analysis: ReturnType<typeof analyzeSong>): StemLayers | undefined {
  const files = LAYERS.map((l) => join(STEMS_SRC, id, `stem-${l}.mp3`));
  if (!files.every((p) => existsSync(p))) return undefined;
  const onset = {} as LayerStrengths;
  const energy = {} as LayerStrengths;
  LAYERS.forEach((l, i) => {
    const pcm = decodePcm(files[i], RATE);
    onset[l] = layerStrengths(pcm, RATE, analysis);
    energy[l] = layerEnergy(pcm, RATE, analysis);
  });
  return { onset, energy };
}
const analysed: Analysed[] = [];
for (const t of tracks) {
  if (!GENRES.includes(t.genre)) throw new Error(`${t.id}: unknown genre "${t.genre}" (tracks.json)`);
  const file = join(MUSIC_DIR, `${t.id}.mp3`);
  const t0 = Date.now();
  const samples = decodePcm(file, RATE);
  const duration = probeDuration(file);
  const analysis = analyzeSong(samples, RATE);
  analysed.push({ t, duration, analysis, layers: loadLayers(t.id, analysis), ms: Date.now() - t0 });
}

// The published order is the players' order (chapters and unlocks go by position), so it is kept:
// a track already in catalog.json keeps its place and its chapter profile; only new tracks are
// rated in and sorted after the known ones. Delete catalog.json to re-rank everything from scratch.
const published: string[] = existsSync(CATALOG)
  ? (JSON.parse(readFileSync(CATALOG, 'utf8')) as { id: string }[]).map((t) => t.id).filter((id) => tracks.some((t) => t.id === id)) // deleted tracks drop out, the rest close ranks
  : [];
const normalStars = new Map(analysed.map((a) => [a.t.id, composeChart(a.analysis, { seed: hash(a.t.id) }).stars]));
const calmest = [...analysed]
  .filter((a) => !a.t.premium)
  .sort((a, b) => normalStars.get(a.t.id)! - normalStars.get(b.t.id)! || a.t.id.localeCompare(b.t.id))
  .map((a) => a.t.id);
const profiles = new Map<string, Profile>();
if (published.length) {
  published.slice(0, BEGINNER_TRACKS).forEach((id) => profiles.set(id, EASY));
  published.slice(BEGINNER_TRACKS, BEGINNER_TRACKS + MEDIUM_TRACKS).forEach((id) => profiles.set(id, MEDIUM));
} else {
  calmest.slice(0, BEGINNER_TRACKS).forEach((id) => profiles.set(id, EASY));
  calmest.slice(BEGINNER_TRACKS, BEGINNER_TRACKS + MEDIUM_TRACKS).forEach((id) => profiles.set(id, MEDIUM));
}

const built: ChartFile[] = [];
for (const { t, duration, analysis, layers, ms } of analysed) {
  const profile = profiles.get(t.id);
  let followed = '';
  const chart = composeChart(analysis, {
    seed: hash(t.id),
    profile,
    layers,
    onLayers: (per) => (followed = per.map((l) => (l ? l[0] : '-')).join('')),
  });
  const file2: ChartFile = {
    id: t.id,
    title: t.title,
    artist: t.artist,
    license: t.license,
    sourceUrl: t.sourceUrl,
    genre: t.genre,
    ...(t.premium ? { premium: true } : {}),
    ...(t.pack ? { pack: t.pack } : {}),
    audio: `music/${t.id}.mp3`,
    bpm: analysis.bpm,
    offset: analysis.beats[0] ?? 0,
    duration: Math.round(duration * 100) / 100,
    beats: analysis.beats,
    chart,
  };
  writeFileSync(join(CHART_DIR, `${t.id}.json`), JSON.stringify(file2));
  built.push(file2);
  const f = chartFeatures(chart);
  const lanes = (chart.sections ?? [[0, 4]]).map((s) => s[1]).join('→');
  console.log(
    `${t.id.padEnd(28)} ${t.genre.padEnd(10)}${t.premium ? ' $' : profile === EASY ? ' E' : profile === MEDIUM ? ' M' : '  '} ${duration.toFixed(0).padStart(4)}s bpm ${analysis.bpm.toString().padStart(5)} ★${chart.stars} ${(chart.notes.length / duration).toFixed(2)}/s ` +
      `notes ${String(chart.notes.length).padStart(4)} holds ${f.holds} slides ${f.slides} rolls ${f.rolls} circles ${f.circles} spins ${f.spins} [${lanes}] ${ms} ms${followed ? ' ' + followed : ''}`,
  );
}

const rank = (c: ChartFile): number => {
  const i = published.indexOf(c.id);
  return i < 0 ? published.length : i;
};
// Packs go after the main catalog, one after another in order of first appearance, each in its own published order.
const packs = [...new Set(tracks.map((t) => t.pack).filter((p): p is string => !!p))];
const packRank = (c: ChartFile): number => (c.pack ? 1 + packs.indexOf(c.pack) : 0);
built.sort(
  (a, b) => packRank(a) - packRank(b) || rank(a) - rank(b) || a.chart.stars - b.chart.stars || a.chart.notes.length - b.chart.notes.length || a.bpm - b.bpm,
);
const catalog = built.map((c) => ({
  id: c.id,
  title: c.title,
  artist: c.artist,
  license: c.license,
  sourceUrl: c.sourceUrl,
  genre: c.genre,
  ...(c.premium ? { premium: true } : {}),
  ...(c.pack ? { pack: c.pack } : {}),
  ...(coverFile(c.id) ? { cover: coverFile(c.id) } : {}),
  bpm: c.bpm,
  duration: c.duration,
  stars: c.chart.stars,
  notes: c.chart.notes.length,
  features: chartFeatures(c.chart),
}));
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
console.log(`catalog.json: ${catalog.length} tracks`);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
