import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
/** Path to the ffmpeg binary bundled by `ffmpeg-static` (dev dependency, asset pipeline only). */
export const FFMPEG: string = require('ffmpeg-static');

export function ffmpeg(args: string[]): void {
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

/** Duration of an audio file in seconds (parsed from ffmpeg's stderr banner). */
export function probeDuration(file: string): number {
  const r = spawnSync(FFMPEG, ['-i', file], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(r.stderr);
  if (!m) throw new Error(`cannot probe ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Decode any audio file to mono float32 PCM at `rate` Hz. */
export function decodePcm(file: string, rate: number): Float32Array {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(rate), '-'], {
    maxBuffer: 1024 * 1024 * 512,
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${file}: ${r.stderr}`);
  const buf: Buffer = r.stdout;
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}
