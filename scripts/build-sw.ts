/**
 * Post-build step (runs from `npm run build` after `vite build`): fills the precache list and
 * the build hash into `dist/sw.js` (copied verbatim from `public/sw.js` by Vite). The logic is in
 * scripts/lib/sw-manifest.ts (pure, tested); this file only walks `dist/`.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHash, collectPrecache, injectManifest, SKIP_DIRS, type HashEntry } from './lib/sw-manifest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SW = join(DIST, 'sw.js');

if (!existsSync(SW)) {
  console.error('build-sw: dist/sw.js not found — run `vite build` first');
  process.exit(1);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (dir === DIST && SKIP_DIRS.has(name)) continue;
      walk(p, out);
    } else out.push(relative(DIST, p).split(sep).join('/'));
  }
  return out;
}

const precache = collectPrecache(walk(DIST));
const entries: HashEntry[] = precache
  .filter((url) => url !== '/')
  .map((url) => ({ path: url, content: readFileSync(join(DIST, url.slice(1))) }));
const hash = buildHash(entries);
const source = readFileSync(SW, 'utf8');
writeFileSync(SW, injectManifest(source, precache, hash));

const bytes = entries.reduce((n, e) => n + e.content.length, 0);
console.log(`sw: build ${hash}, ${precache.length} URLs precached (${(bytes / 1024).toFixed(0)} KB)`);
