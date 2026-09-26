/**
 * Pure helpers for `scripts/build-sw.ts`: which files of `dist/` form the app shell, how the
 * build is versioned and how the list is injected into `public/sw.js`. No I/O here so the
 * logic is unit-testable (`sw-manifest.test.ts`).
 */
import { createHash } from 'node:crypto';

/** `public/sw.js` contains `const PRECACHE = /* __NEON_PRECACHE__ *\/ [];` — replaced by the JSON list. */
export const PRECACHE_PLACEHOLDER = /\/\*\s*__NEON_PRECACHE__\s*\*\/\s*\[\]/g;
/** `public/sw.js` contains `'__NEON_BUILD__'` — replaced by the build hash. */
export const BUILD_PLACEHOLDER = /__NEON_BUILD__/g;

const SHELL_ROOT_FILES = new Set(['manifest.webmanifest', 'privacy.html']);
// webp: the loading screen's key art and logo (hashed by Vite from index.html) must be there offline too.
const SHELL_ASSET_RE = /^assets\/[^/]+\.(js|css|woff2?|ttf|otf|svg|webp)$/;

/** Normalise a dist path: backslashes → slashes, leading `./` dropped. */
export function normalizeDistPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.?\//, '');
}

/**
 * dist-relative file paths → URLs to precache. Only the app shell: `/` (index.html), the hashed
 * `assets/*`, the manifest, the privacy page and the SVG icon. Media (music, charts, sfx, voice,
 * PNG icons) is never precached — it goes into the runtime cache on first use.
 */
export function collectPrecache(files: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of files) {
    const f = normalizeDistPath(raw);
    if (f === 'index.html') {
      out.add('/');
      out.add('/index.html');
    } else if (SHELL_ROOT_FILES.has(f) || f === 'icons/icon.svg' || SHELL_ASSET_RE.test(f)) {
      out.add('/' + f);
    }
  }
  return [...out].sort();
}

export interface HashEntry {
  path: string;
  content: Uint8Array | string;
}

/** Deterministic 12-hex-char version of the shell: sha256 over sorted (path, content) pairs. */
export function buildHash(entries: readonly HashEntry[]): string {
  const h = createHash('sha256');
  for (const e of [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    h.update(e.path);
    h.update('\0');
    h.update(e.content);
    h.update('\0');
  }
  return h.digest('hex').slice(0, 12);
}

function count(src: string, re: RegExp): number {
  return (src.match(re) ?? []).length;
}

/**
 * Replace both placeholders in the service-worker source. Throws when a placeholder is missing
 * or duplicated so a broken `sw.js` never ships silently.
 */
export function injectManifest(sw: string, precache: readonly string[], hash: string): string {
  if (!/^[0-9a-f]{6,64}$/.test(hash)) throw new Error(`build-sw: bad build hash "${hash}"`);
  for (const url of precache) {
    if (!url.startsWith('/')) throw new Error(`build-sw: precache URL must be absolute: ${url}`);
  }
  if (count(sw, PRECACHE_PLACEHOLDER) !== 1) throw new Error('build-sw: expected exactly one __NEON_PRECACHE__ placeholder');
  if (count(sw, BUILD_PLACEHOLDER) !== 1) throw new Error('build-sw: expected exactly one __NEON_BUILD__ placeholder');
  return sw.replace(PRECACHE_PLACEHOLDER, JSON.stringify([...precache])).replace(BUILD_PLACEHOLDER, hash);
}

/** Directories of `dist/` that never contain shell files — skipped while walking (music is 60+ MB). */
export const SKIP_DIRS = new Set(['music', 'voice', 'sfx', 'charts']);
