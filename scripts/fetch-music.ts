/**
 * Re-fetch the raw sources of assets-src/tracks.json from their OpenGameArt pages into
 * assets-src/music-raw/<raw> — only the ones that are missing. The page's "Files" attachments are
 * the links under /sites/default/files/ (previews live under /audio_preview/ and are skipped).
 * Usage: npm run assets:fetch-music
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface RawTrack {
  id: string;
  raw: string;
  sourceUrl: string;
  /** Exact attachment to fetch when the page has several (loop vs opening, tempo variants). */
  rawUrl?: string;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW_DIR = join(ROOT, 'assets-src', 'music-raw');
const tracks = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'tracks.json'), 'utf8')) as RawTrack[];
mkdirSync(RAW_DIR, { recursive: true });

const ATTACHMENT = /https:\/\/opengameart\.org\/sites\/default\/files\/[^"'<> ]+?\.(?:mp3|ogg|wav|flac)/g;

function pickFile(html: string, raw: string): string | null {
  const links = [...new Set([...html.matchAll(ATTACHMENT)].map((m) => m[0]))].filter((u) => !u.includes('/audio_preview/') && !u.includes('/styles/'));
  if (links.length === 0) return null;
  const ext = raw.split('.').pop()!;
  // Prefer the attachment with the wanted extension, then the longest name (full tracks over stingers).
  const same = links.filter((u) => u.endsWith('.' + ext));
  const pool = same.length ? same : links;
  return pool.sort((a, b) => b.length - a.length)[0];
}

let ok = 0;
let failed = 0;
for (const t of tracks) {
  const out = join(RAW_DIR, t.raw);
  if (existsSync(out)) continue;
  try {
    const url = t.rawUrl ?? pickFile(await (await fetch(t.sourceUrl, { headers: { 'user-agent': 'neon-tap asset fetch' } })).text(), t.raw);
    if (!url) throw new Error('no attachment link on the page');
    const res = await fetch(url, { headers: { 'user-agent': 'neon-tap asset fetch' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100_000) throw new Error(`too small (${buf.length} B): ${url}`);
    writeFileSync(out, buf);
    ok++;
    console.log(`${t.id}: ${url.split('/').pop()} (${Math.round(buf.length / 1024)} KB)`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${t.id}: ${(e as Error).message}`);
  }
}
console.log(`fetched ${ok}, failed ${failed}`);
