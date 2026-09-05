/**
 * assets-src/music-local/* → public/local/{music/<id>.mp3, charts/<id>.json, catalog.json}
 *
 * Dev-only tracks the author owns (never committed, never deployed — see assets-src/music-local/README.md).
 * Same encoding as `assets:music` (encodeGameTrack) and the same analysis as `assets:charts`
 * (src/shared/lib/analysis), so a local song plays exactly like a built-in one.
 *
 *   id     = slug of the file name, Cyrillic transliterated: «Noize MC - Лебединое озеро.mp3» → noize-mc-lebedinoe-ozero
 *   artist / title from «Artist - Title.ext»; otherwise title = file name, artist = ''
 *   genre 'local', license 'private', sourceUrl ''
 *
 * Usage: npm run assets:local [-- --force]   (--force re-encodes files whose mp3 is already up to date)
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePcm, encodeGameTrack, probeDuration } from './ffmpeg';
import { analyzeSong, chartFeatures, composeChart } from '../src/shared/lib/analysis';
import { isAudioFile, parseTrackName, uniqueIds } from '../src/shared/lib/local-tracks';
import { LOCAL_GENRE, type ChartFile } from '../src/shared/types/chart';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IN_DIR = join(ROOT, 'assets-src', 'music-local');
const OUT_DIR = join(ROOT, 'public', 'local');
const MUSIC_DIR = join(OUT_DIR, 'music');
const CHART_DIR = join(OUT_DIR, 'charts');
const CATALOG = join(OUT_DIR, 'catalog.json');
const RATE = 22050;
const FORCE = process.argv.includes('--force');

mkdirSync(IN_DIR, { recursive: true });
mkdirSync(MUSIC_DIR, { recursive: true });
mkdirSync(CHART_DIR, { recursive: true });

const files = readdirSync(IN_DIR)
  .filter((f) => isAudioFile(f))
  .sort((a, b) => a.localeCompare(b, 'ru'));
const parsed = files.map((f) => parseTrackName(f));
const ids = uniqueIds(parsed.map((p) => p.id));

if (files.length === 0) {
  console.log(`no audio files in ${IN_DIR} — drop mp3/ogg/wav/m4a/flac there and run again`);
}

const built: ChartFile[] = [];
for (let i = 0; i < files.length; i++) {
  const src = join(IN_DIR, files[i]);
  const id = ids[i];
  const { title, artist } = parsed[i];
  const mp3 = join(MUSIC_DIR, `${id}.mp3`);
  const t0 = Date.now();

  const fresh = !FORCE && existsSync(mp3) && statSync(mp3).mtimeMs >= statSync(src).mtimeMs;
  if (fresh) {
    console.log(`${id}: mp3 up to date (use --force to re-encode)`);
  } else {
    const { duration, cut } = encodeGameTrack(src, mp3);
    console.log(`${id}: ${files[i]} ${duration.toFixed(1)}s → ${cut.toFixed(1)}s`);
  }

  const samples = decodePcm(mp3, RATE);
  const duration = probeDuration(mp3);
  const analysis = analyzeSong(samples, RATE);
  const chart = composeChart(analysis, { seed: hash(id) });
  const file: ChartFile = {
    id,
    title,
    artist,
    license: 'private',
    sourceUrl: '',
    genre: LOCAL_GENRE,
    audio: `local/music/${id}.mp3`,
    bpm: analysis.bpm,
    offset: analysis.beats[0] ?? 0,
    duration: Math.round(duration * 100) / 100,
    beats: analysis.beats,
    chart,
  };
  writeFileSync(join(CHART_DIR, `${id}.json`), JSON.stringify(file));
  built.push(file);
  const f = chartFeatures(chart);
  const lanes = (chart.sections ?? [[0, 4]]).map((s) => s[1]).join('→');
  console.log(
    `${id.padEnd(28)} ${duration.toFixed(0).padStart(4)}s bpm ${analysis.bpm.toString().padStart(5)} ★${chart.stars} ${(chart.notes.length / duration).toFixed(2)}/s ` +
      `notes ${String(chart.notes.length).padStart(4)} holds ${f.holds} slides ${f.slides} rolls ${f.rolls} circles ${f.circles} [${lanes}] ${Date.now() - t0} ms`,
  );
}

built.sort((a, b) => a.chart.stars - b.chart.stars || a.chart.notes.length - b.chart.notes.length || a.bpm - b.bpm);
const catalog = built.map((c) => ({
  id: c.id,
  title: c.title,
  artist: c.artist,
  license: c.license,
  sourceUrl: c.sourceUrl,
  genre: c.genre,
  bpm: c.bpm,
  duration: c.duration,
  stars: c.chart.stars,
  notes: c.chart.notes.length,
  features: chartFeatures(c.chart),
  local: true,
}));
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
console.log(`${CATALOG}: ${catalog.length} local track(s) — npm run dev, section «Локальные треки»`);

const stale = readdirSync(MUSIC_DIR).filter((f) => f.endsWith('.mp3') && !ids.includes(f.slice(0, -4)));
if (stale.length) console.log(`not in the catalog any more (source file removed; delete by hand if unwanted): ${stale.join(', ')}`);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
