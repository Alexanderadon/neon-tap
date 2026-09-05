/**
 * public/music/<id>.mp3 → public/charts/<id>.json + src/entities/track/model/catalog.json
 *
 * Runs the exact same analysis pipeline the browser uses for custom songs
 * (src/shared/lib/analysis): onsets → tempo → DP beat tracking → 16th grid → 4-bar rhythm
 * profiles → pattern notes / holds / slides / rolls / circle runs / lane-count sections. One chart
 * per song; the catalog is sorted easiest-first by stars, then by notes per second. Registry
 * fields `genre` and `premium` pass through to the chart file and the catalog.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePcm, probeDuration } from "./ffmpeg";
import {
  analyzeSong,
  chartFeatures,
  composeChart,
} from "../src/shared/lib/analysis";
import { GENRES, type ChartFile, type Genre } from "../src/shared/types/chart";

interface RawTrack {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  raw: string;
  sourceUrl: string;
  license: string;
  /** Optional registry flag (set by the catalog stream); passed through untouched. */
  premium?: boolean;
}

/** Chart file plus the optional registry passthrough. */
type BuiltChart = ChartFile & { premium?: boolean };

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MUSIC_DIR = join(ROOT, "public", "music");
const CHART_DIR = join(ROOT, "public", "charts");
const CATALOG = join(ROOT, "src", "entities", "track", "model", "catalog.json");
const RATE = 22050;

mkdirSync(CHART_DIR, { recursive: true });
const tracks = JSON.parse(
  readFileSync(join(ROOT, "assets-src", "tracks.json"), "utf8"),
) as RawTrack[];

const built: BuiltChart[] = [];
for (const t of tracks) {
  if (!GENRES.includes(t.genre))
    throw new Error(`${t.id}: unknown genre "${t.genre}" (tracks.json)`);
  const file = join(MUSIC_DIR, `${t.id}.mp3`);
  const t0 = Date.now();
  const samples = decodePcm(file, RATE);
  const duration = probeDuration(file);
  const analysis = analyzeSong(samples, RATE);
  const chart = composeChart(analysis, { seed: hash(t.id) });
  const file2: BuiltChart = {
    id: t.id,
    title: t.title,
    artist: t.artist,
    license: t.license,
    sourceUrl: t.sourceUrl,
    genre: t.genre,
    ...(t.premium !== undefined ? { premium: t.premium } : {}),
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
  const lanes = (chart.sections ?? [[0, 4]]).map((s) => s[1]).join("→");
  console.log(
    `${t.id.padEnd(28)} ${t.genre.padEnd(10)} ${duration.toFixed(0).padStart(4)}s bpm ${analysis.bpm.toString().padStart(5)} ★${chart.stars} ${nps(file2).toFixed(2)}/s ` +
      `notes ${String(chart.notes.length).padStart(4)} holds ${f.holds} slides ${f.slides} rolls ${f.rolls} circles ${f.circles} lanes ${lanes} ${Date.now() - t0} ms`,
  );
}

// Easiest first: stars, then felt density (notes per second), then tempo.
built.sort(
  (a, b) => a.chart.stars - b.chart.stars || nps(a) - nps(b) || a.bpm - b.bpm,
);
const catalog = built.map((c) => ({
  id: c.id,
  title: c.title,
  artist: c.artist,
  license: c.license,
  sourceUrl: c.sourceUrl,
  genre: c.genre,
  ...(c.premium !== undefined ? { premium: c.premium } : {}),
  bpm: c.bpm,
  duration: c.duration,
  stars: c.chart.stars,
  notes: c.chart.notes.length,
  features: chartFeatures(c.chart),
}));
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + "\n");
console.log(`catalog.json: ${catalog.length} tracks`);

function nps(c: BuiltChart): number {
  return c.chart.notes.length / Math.max(1, c.duration);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
