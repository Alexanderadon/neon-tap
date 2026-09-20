/**
 * public/music/<id>.mp3 → public/charts/<id>.json + src/entities/track/model/catalog.json
 *
 * Runs the exact same analysis pipeline the browser uses for custom songs
 * (src/shared/lib/analysis): onsets → tempo → DP beat tracking → 16th grid → audibility → one
 * figure per phrase under the song's ★ budget → holds / slides / rolls / chords / circle windows /
 * spinners / lane-count sections. One chart per song. The chapter comes from the catalog position
 * (the first BEGINNER_TRACKS are chapter one ★1–2, the next MEDIUM_TRACKS chapter two ★3–4, the
 * rest and the packs ★2–6); a per-track `chart` in tracks.json overrides the target ★ and the roll
 * policy. Every chart passes the hands gate (`assertPlayable`) and the ★ gate (its check rating is
 * at most its target, never above MAX_STARS) or the run aborts. `--dry` composes and prints without
 * writing the charts or the catalog.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePcm, probeDuration } from './ffmpeg';
import {
  LAYERS,
  MAX_STARS,
  analyzeSong,
  assertPlayable,
  chartBarTimes,
  chartFeatures,
  composeChart,
  layerEnergy,
  layerStrengths,
  rateStars,
  songEnergy,
  type Chapter,
  type ComposeTrace,
  type LayerStrengths,
  type RollPolicy,
  type StemLayers,
} from '../src/shared/lib/analysis';
import { GENRES, type ChartFile, type Genre } from '../src/shared/types/chart';
import type { TrackPalette } from '../src/shared/lib/render/themes';

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
  /** Per-track composer overrides: the target ★ (still ≤ 6) and the mid-phrase roll policy. */
  chart?: { stars?: number; rolls?: RollPolicy };
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** Picture cover made by `npm run assets:covers` — recorded in the catalog so the app knows to show it. */
const coverFile = (id: string): string | undefined => (existsSync(join(ROOT, 'public', 'covers', `${id}.webp`)) ? `covers/${id}.webp` : undefined);
/** The picture's accent colour and level palette (`assets:covers` keeps them in assets-src/covers-raw/covers.json). */
const COVERS = join(ROOT, 'assets-src', 'covers-raw', 'covers.json');
const colors: Record<string, { tint: string; palette: TrackPalette }> = existsSync(COVERS) ? (JSON.parse(readFileSync(COVERS, 'utf8')) as Record<string, { tint: string; palette: TrackPalette }>) : {};
const MUSIC_DIR = join(ROOT, 'public', 'music');
const CHART_DIR = join(ROOT, 'public', 'charts');
const CATALOG = join(ROOT, 'src', 'entities', 'track', 'model', 'catalog.json');
/** Raw Demucs output (stem-{drums,bass,other,vocals}.mp3): the chart follows these instruments; never shipped. */
const STEMS_SRC = process.env.STEMS_DIR ?? 'D:/neon-tap-tools/stems';
const RATE = 22050;
/** The first tracks of the catalog are chapter one (★1–2), the next ones chapter two (★3–4). */
const BEGINNER_TRACKS = 10;
const MEDIUM_TRACKS = 10;
/** Compose and print only — neither the charts nor the catalog are written. */
const DRY = process.argv.includes('--dry');

if (!DRY) mkdirSync(CHART_DIR, { recursive: true });
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
// a track already in catalog.json keeps its place and its chapter; only new tracks are rated in
// and sorted after the known ones. `--rerank` (or no catalog.json) orders everything from scratch:
// by the ★ a song gets as a normal track, then by its energy, easiest first.
const rerank = process.argv.includes('--rerank');
const published: string[] =
  existsSync(CATALOG) && !rerank
    ? (JSON.parse(readFileSync(CATALOG, 'utf8')) as { id: string }[]).map((t) => t.id).filter((id) => tracks.some((t) => t.id === id)) // deleted tracks drop out, the rest close ranks
    : [];
/** How hard the song is on its own: its ★ and energy read as a normal track. */
const naturalOf = (a: Analysed): { stars: number; energy: number } => {
  let trace: ComposeTrace | undefined;
  const chart = composeChart(a.analysis, { seed: hash(a.t.id), layers: a.layers, onTrace: (tr) => (trace = tr) });
  return { stars: chart.stars, energy: songEnergy(trace!.energy) };
};
const order = published.length
  ? published
  : [...analysed]
      .filter((a) => !a.t.premium && !a.t.pack)
      .map((a) => ({ id: a.t.id, ...naturalOf(a) }))
      .sort((a, b) => a.stars - b.stars || a.energy - b.energy || a.id.localeCompare(b.id))
      .map((a) => a.id);
const chapters = new Map<string, Chapter>();
order.slice(0, BEGINNER_TRACKS).forEach((id) => chapters.set(id, 'easy'));
order.slice(BEGINNER_TRACKS, BEGINNER_TRACKS + MEDIUM_TRACKS).forEach((id) => chapters.set(id, 'medium'));

const built: ChartFile[] = [];
for (const { t, duration, analysis, layers, ms } of analysed) {
  const chapter: Chapter = t.pack ? 'normal' : (chapters.get(t.id) ?? 'normal');
  let trace: ComposeTrace | undefined;
  const chart = composeChart(analysis, {
    seed: hash(t.id),
    chapter,
    layers,
    targetStars: t.chart?.stars,
    rolls: t.chart?.rolls,
    onTrace: (tr) => (trace = tr),
  });
  checkGates(t.id, chart, analysis, trace!);
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
  if (!DRY) writeFileSync(join(CHART_DIR, `${t.id}.json`), JSON.stringify(file2));
  built.push(file2);
  const f = chartFeatures(chart);
  const lane = chart.notes.filter((n) => n[3] !== 'spin');
  const chords = lane.length - new Set(lane.map((n) => n[0])).size;
  const lanes = (chart.sections ?? [[0, 4]]).map((s) => s[1]).join('→');
  console.log(
    `${t.id.padEnd(28)} ${t.genre.padEnd(10)}${t.premium ? ' $' : chapter === 'easy' ? ' E' : chapter === 'medium' ? ' M' : '  '} ${duration.toFixed(0).padStart(4)}s bpm ${analysis.bpm.toString().padStart(5)} ` +
      `★${trace!.target} (check ★${trace!.stars}) E ${songEnergy(trace!.energy).toFixed(2)} levels ${trace!.levels.join('')} shrinks ${trace!.shrinks}/${trace!.repairs} ` +
      `${(chart.notes.length / duration).toFixed(2)}/s notes ${String(chart.notes.length).padStart(4)} H${f.holds}/S${f.slides}/R${f.rolls}/C${f.circles}/Sp${f.spins}/Ch${chords} [${lanes}] ${ms} ms` +
      (trace!.fails.length ? ` fails: ${trace!.fails.join(', ')}` : ''),
  );
}

const rank = (c: ChartFile): number => {
  const i = order.indexOf(c.id);
  return i < 0 ? order.length : i;
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
  ...(coverFile(c.id) && colors[c.id] ? { tint: colors[c.id].tint, palette: colors[c.id].palette } : {}),
  bpm: c.bpm,
  duration: c.duration,
  stars: c.chart.stars,
  notes: c.chart.notes.length,
  features: chartFeatures(c.chart),
}));
if (DRY) console.log(`--dry: ${catalog.length} tracks composed, nothing written`);
else {
  writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`catalog.json: ${catalog.length} tracks`);
}

/**
 * The gates every shipped chart passes, or the run aborts naming the track and the reasons: the
 * hands rules at the fastest level (`assertPlayable`), ★ ≤ MAX_STARS, and the check rating (the ★
 * whose budget the chart fits, recomputed here on the bar grid) at most the composer's target.
 */
function checkGates(id: string, chart: ChartFile['chart'], analysis: ReturnType<typeof analyzeSong>, trace: ComposeTrace): void {
  const slots = analysis.slots;
  const last = slots[slots.length - 1];
  const slotSec = slots.length > 1 ? (last.time - slots[0].time) / (slots.length - 1) : 15 / analysis.bpm;
  const barTimes = chartBarTimes(analysis);
  const problems: string[] = [];
  try {
    assertPlayable(chart, slotSec);
  } catch (err) {
    problems.push(err instanceof Error ? err.message : String(err));
  }
  if (chart.stars > MAX_STARS) problems.push(`★${chart.stars} above the ceiling ★${MAX_STARS}`);
  const check = rateStars(chart.notes, analysis.bpm, chart.sections, barTimes);
  if (check > trace.target) problems.push(`check ★${check} above the target ★${trace.target}: ${trace.fails.join(', ') || 'see budgetFeatures'}`);
  if (problems.length) throw new Error(`${id}: chart failed the gate\n  ${problems.join('\n  ')}`);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
