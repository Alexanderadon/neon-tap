/**
 * assets-src/music-raw/* → public/music/<id>.mp3
 * Trims to ≤ 150 s (GDD: 90–150 s sessions), normalises loudness, fades the cut, encodes 128 kbps
 * (`encodeGameTrack` in ./ffmpeg — the same encoding `assets:local` uses for the author's own files).
 * Licenses report: `npm run assets:licenses`.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGameTrack } from './ffmpeg';

interface RawTrack {
  id: string;
  title: string;
  artist: string;
  raw: string;
  sourceUrl: string;
  license: string;
  /** Repeat short loop-style tracks N times to reach a 90–150 s session. */
  loops?: number;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW_DIR = join(ROOT, 'assets-src', 'music-raw');
const OUT_DIR = join(ROOT, 'public', 'music');

const tracks = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'tracks.json'), 'utf8')) as RawTrack[];
mkdirSync(OUT_DIR, { recursive: true });

for (const t of tracks) {
  const src = join(RAW_DIR, t.raw);
  if (!existsSync(src)) {
    console.warn(`skip ${t.id}: ${t.raw} missing`);
    continue;
  }
  const out = join(OUT_DIR, `${t.id}.mp3`);
  const { duration, cut } = encodeGameTrack(src, out, { loops: t.loops });
  console.log(`${t.id}: ${duration.toFixed(1)}s → ${cut.toFixed(1)}s`);
}
