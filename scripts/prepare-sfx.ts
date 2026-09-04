/**
 * assets-src/sfx-raw/<pack>/*.ogg → public/sfx/<name>.mp3 according to assets-src/sfx.json.
 * OGG Vorbis does not decode in Safari, so everything ships as MP3 (mono, 44.1 kHz, 96 kbps).
 * Peak-normalised to −1 dBFS, leading/trailing silence trimmed.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffmpeg } from './ffmpeg';

interface Registry {
  packs: Record<string, { name: string; url: string; license: string; dir: string }>;
  samples: Record<string, { pack: string; file: string; role: string }>;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW = join(ROOT, 'assets-src', 'sfx-raw');
const OUT = join(ROOT, 'public', 'sfx');
mkdirSync(OUT, { recursive: true });

const reg = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'sfx.json'), 'utf8')) as Registry;
for (const [name, s] of Object.entries(reg.samples)) {
  const src = join(RAW, reg.packs[s.pack].dir, s.file);
  const out = join(OUT, `${name}.mp3`);
  ffmpeg([
    '-i',
    src,
    '-af',
    'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.02,alimiter=limit=0.89:level=false,volume=-1dB',
    '-ac',
    '1',
    '-ar',
    '44100',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '96k',
    out,
  ]);
  console.log(`${name.padEnd(18)} ← ${s.pack}/${s.file}`);
}
