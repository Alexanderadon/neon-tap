/**
 * assets-src/voice-raw/*.wav (Windows SAPI "Microsoft Irina") → public/voice/*.mp3
 * Trims silence, normalises, encodes mono 64 kbps. Run `scripts/tts.ps1` first to (re)create the WAVs.
 */
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ffmpeg } from './ffmpeg';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW_DIR = join(ROOT, 'assets-src', 'voice-raw');
const OUT_DIR = join(ROOT, 'public', 'voice');
mkdirSync(OUT_DIR, { recursive: true });

for (const file of readdirSync(RAW_DIR).filter((f) => f.endsWith('.wav'))) {
  const out = join(OUT_DIR, file.replace(/\.wav$/, '.mp3'));
  ffmpeg([
    '-i',
    join(RAW_DIR, file),
    '-af',
    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5',
    '-ac',
    '1',
    '-ar',
    '22050',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '64k',
    out,
  ]);
  console.log(file, '→', out);
}
