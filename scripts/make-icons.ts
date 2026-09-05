/**
 * PWA icons from the procedural mark (scripts/lib/icon-render.ts) through the pure-Node PNG
 * encoder (scripts/lib/png.ts): icon-192, icon-512, icon-maskable-512, apple-touch-icon-180.
 *
 *   npm run assets:icons                 # writes missing files only
 *   npm run assets:icons -- --force      # regenerate everything
 *   npm run assets:icons -- --out .tmp/icons
 *
 * `public/icons/icon.svg` stays the source of the design; this script mirrors it in raster.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIcon, type IconOptions } from './lib/icon-render';
import { encodePng } from './lib/png';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const force = args.includes('--force');
const outArg = args[args.indexOf('--out') + 1];
const OUT = args.includes('--out') && outArg ? resolve(ROOT, outArg) : join(ROOT, 'public', 'icons');

interface Target {
  file: string;
  size: number;
  opts?: IconOptions;
}

const TARGETS: Target[] = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, opts: { maskable: true } },
  { file: 'apple-touch-icon-180.png', size: 180, opts: { opaque: true } },
];

mkdirSync(OUT, { recursive: true });
for (const t of TARGETS) {
  const path = join(OUT, t.file);
  if (existsSync(path) && !force) {
    console.log(`skip  ${t.file} (exists; --force to overwrite)`);
    continue;
  }
  const started = performance.now();
  const png = encodePng(t.size, t.size, renderIcon(t.size, t.opts));
  writeFileSync(path, png);
  console.log(`wrote ${t.file}  ${t.size}×${t.size}  ${(png.length / 1024).toFixed(1)} KB  ${(performance.now() - started).toFixed(0)} ms`);
}
console.log(`icons → ${OUT}`);
