/**
 * Naming rules for dev-only local tracks (`assets-src/music-local` → `public/local`).
 * Pure string functions shared by `scripts/prepare-local.ts` and the tests; no Node APIs.
 */

/** Audio file extensions `npm run assets:local` picks up (lower-case, with the dot). */
export const AUDIO_EXTENSIONS: readonly string[] = ['.mp3', '.ogg', '.oga', '.wav', '.m4a', '.aac', '.flac', '.opus', '.wma', '.webm'];

export function isAudioFile(fileName: string): boolean {
  return AUDIO_EXTENSIONS.includes(extensionOf(fileName));
}

/** Lower-cased extension with the dot (`'.MP3'` → `'.mp3'`), `''` when there is none. */
export function extensionOf(fileName: string): string {
  const m = /\.[^./\\]+$/.exec(fileName);
  return m ? m[0].toLowerCase() : '';
}

export function stripExtension(fileName: string): string {
  return isAudioFile(fileName) ? fileName.slice(0, fileName.length - extensionOf(fileName).length) : fileName;
}

/** Cyrillic → Latin, one letter at a time (Russian + the Ukrainian / Belarusian extras). */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  і: 'i', ї: 'yi', є: 'ye', ґ: 'g', ў: 'u',
};

/** Transliterate Cyrillic letters to Latin, keep everything else; case is preserved for Latin, Cyrillic comes out lower-case. */
export function transliterate(s: string): string {
  let out = '';
  for (const ch of s) {
    const lower = ch.toLowerCase();
    const t = CYRILLIC[lower];
    if (t === undefined) out += ch;
    else out += ch === lower ? t : t.charAt(0).toUpperCase() + t.slice(1);
  }
  return out;
}

/**
 * URL/file-safe id: transliterate, drop diacritics, lower-case, `[a-z0-9]` runs joined by `-`.
 * `'Noize MC - Лебединое озеро'` → `'noize-mc-lebedinoe-ozero'`. Empty input → `'track'`.
 */
export function slugify(s: string): string {
  const slug = transliterate(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'track';
}

export interface ParsedTrackName {
  /** Slug of the whole base name (artist + title), so two songs with one title stay apart. */
  id: string;
  title: string;
  /** Empty when the file name has no `Artist - Title` separator. */
  artist: string;
}

const SEPARATOR = /\s+[-–—]\s+/;

/**
 * `'Artist - Title.mp3'` → artist + title; a leading track number (`'03 - '`, `'03. '`) is dropped;
 * anything else → title = base name, artist = ''. The id is the slug of the base name (number included
 * in the slug only when it is the whole name).
 */
export function parseTrackName(fileName: string): ParsedTrackName {
  const base = stripExtension(fileName.replace(/^.*[\\/]/, '')).trim();
  const withoutNumber = base.replace(/^\d{1,3}(?:\s*[.)-]\s*|\s+)(?=\S)/, '').trim();
  const name = withoutNumber || base;
  const parts = name
    .split(SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);
  const id = slugify(name);
  if (parts.length >= 2) return { id, artist: parts[0], title: parts.slice(1).join(' - ') };
  return { id, artist: '', title: name };
}

/** Make ids unique in file order: a repeat gets `-2`, `-3`, … appended. */
export function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return ids.map((id) => {
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    return n === 0 ? id : `${id}-${n + 1}`;
  });
}
