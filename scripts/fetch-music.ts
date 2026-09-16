/**
 * Re-fetch the raw sources of assets-src/tracks.json from their source pages into
 * assets-src/music-raw/<raw> — only the ones that are missing.
 *  - OpenGameArt: the page's "Files" attachments are the links under /sites/default/files/
 *    (previews live under /audio_preview/ and are skipped).
 *  - Free Music Archive: the download button needs a login, but the player's stream URL
 *    (`playbackUrl` in the page) redirects to the full file. The licence printed on the page is
 *    checked against the registry — a track whose page says BY-NC or BY-ND is refused.
 * Usage: npm run assets:fetch-music
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface RawTrack {
  id: string;
  raw: string;
  sourceUrl: string;
  license: string;
  /** Exact attachment to fetch when the page has several (loop vs opening, tempo variants). */
  rawUrl?: string;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW_DIR = join(ROOT, 'assets-src', 'music-raw');
const tracks = JSON.parse(readFileSync(join(ROOT, 'assets-src', 'tracks.json'), 'utf8')) as RawTrack[];
mkdirSync(RAW_DIR, { recursive: true });

const HEADERS = { 'user-agent': 'Mozilla/5.0 neon-tap asset fetch' };
const ATTACHMENT = /https:\/\/opengameart\.org\/sites\/default\/files\/[^"'<> ]+?\.(?:mp3|ogg|wav|flac)/g;
const CC_LINK = /creativecommons\.org\/(licenses|publicdomain)\/([a-z-]+)\/([0-9.]+)/g;

function pickOgaFile(html: string, raw: string): string | null {
  const links = [...new Set([...html.matchAll(ATTACHMENT)].map((m) => m[0]))].filter((u) => !u.includes('/audio_preview/') && !u.includes('/styles/'));
  if (links.length === 0) return null;
  const ext = raw.split('.').pop()!;
  // Prefer the attachment with the wanted extension, then the longest name (full tracks over stingers).
  const same = links.filter((u) => u.endsWith('.' + ext));
  const pool = same.length ? same : links;
  return pool.sort((a, b) => b.length - a.length)[0];
}

/** "CC BY 4.0" / "CC BY-NC-ND 4.0" / "CC0 1.0" from the page's creativecommons.org links. */
function pageLicense(html: string): string | null {
  const m = [...html.matchAll(CC_LINK)][0];
  if (!m) return null;
  return m[1] === 'publicdomain' ? `CC0 ${m[3]}` : `CC ${m[2].toUpperCase()} ${m[3]}`;
}

function pickFmaFile(html: string, t: RawTrack): string {
  const lic = pageLicense(html);
  if (lic !== t.license) throw new Error(`page licence "${lic}" ≠ registry "${t.license}" — fix tracks.json first`);
  if (/-(NC|ND)\b/.test(lic)) throw new Error(`${lic} does not allow a commercial game / sped-up levels`);
  const stream = html.match(/"playbackUrl":"([^"]+)"/)?.[1];
  if (!stream) throw new Error('no playbackUrl on the page');
  return stream.split('\\/').join('/');
}

let ok = 0;
let failed = 0;
for (const t of tracks) {
  const out = join(RAW_DIR, t.raw);
  if (existsSync(out)) continue;
  try {
    let url = t.rawUrl;
    if (!url) {
      const html = await (await fetch(t.sourceUrl, { headers: HEADERS })).text();
      url = t.sourceUrl.includes('freemusicarchive.org') ? pickFmaFile(html, t) : (pickOgaFile(html, t.raw) ?? undefined);
    }
    if (!url) throw new Error('no attachment link on the page');
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100_000) throw new Error(`too small (${buf.length} B): ${url}`);
    writeFileSync(out, buf);
    ok++;
    console.log(`${t.id}: ${res.url.split('/').pop()} (${Math.round(buf.length / 1024)} KB)`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${t.id}: ${(e as Error).message}`);
  }
}
console.log(`fetched ${ok}, failed ${failed}`);
