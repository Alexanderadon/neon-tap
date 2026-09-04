/**
 * assets-src/music-raw/* → public/music/<id>.mp3
 * Trims to ≤ 150 s (GDD: 90–150 s sessions), normalises loudness, fades the cut, encodes 128 kbps.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffmpeg, probeDuration } from './ffmpeg';

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
const MAX_SEC = 150;

const tracks = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'tracks.json'), 'utf8')) as RawTrack[];
mkdirSync(OUT_DIR, { recursive: true });

const lines: string[] = [
  '# Music licenses',
  '',
  'Every built-in track is released under **CC0 1.0 (public domain dedication)** by its author on OpenGameArt.org.',
  'Files were trimmed to ≤ 150 s and loudness-normalised for the game; no other changes.',
  'Attribution is not legally required for CC0 — it is listed here out of respect for the authors.',
  '',
  '| File | Title | Author | Source | License |',
  '|---|---|---|---|---|',
];

for (const t of tracks) {
  const src = join(RAW_DIR, t.raw);
  if (!existsSync(src)) {
    console.warn(`skip ${t.id}: ${t.raw} missing`);
    continue;
  }
  const out = join(OUT_DIR, `${t.id}.mp3`);
  const dur = probeDuration(src) * (t.loops ?? 1);
  const cut = Math.min(dur, MAX_SEC);
  const fade = cut < dur ? `,afade=t=out:st=${(cut - 3).toFixed(2)}:d=3` : '';
  const loops = t.loops ?? 1;
  ffmpeg([...(loops > 1 ? ['-stream_loop', String(loops - 1)] : []), '-i', src, '-t', String(cut), '-af', `loudnorm=I=-14:TP=-1.5:LRA=11${fade}`, '-ac', '2', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '128k', out]);
  console.log(`${t.id}: ${dur.toFixed(1)}s → ${cut.toFixed(1)}s`);
  lines.push(`| \`${t.id}.mp3\` | ${t.title} | ${t.artist} | [OpenGameArt](${t.sourceUrl}) | ${t.license} |`);
}

lines.push('', '## Voice', '', 'Russian voice lines in `public/voice/` were synthesised locally with the Windows SAPI voice "Microsoft Irina" — no third-party recordings.', '');
lines.push('## Sound effects', '', 'All SFX (hit ticks, miss "glass", metronome, UI blips) are synthesised at runtime with the Web Audio API. No audio samples are shipped.', '');
writeFileSync(join(OUT_DIR, 'LICENSES.md'), lines.join('\n'));
console.log('LICENSES.md written');
