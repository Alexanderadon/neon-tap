import { dict, fmt } from '@/shared/i18n';
import { CATALOG } from './catalog';

/** Tracks per numbered chapter — the progress segments above the deck. */
export const CHAPTER_SIZE = 10;

/** A run of catalog positions shown as one chapter row: «ГЛАВА N» or a named pack («РОК-ПАК»). */
export interface Chapter {
  /** First catalog position. */
  start: number;
  /** One past the last catalog position. */
  end: number;
  /** 1-based number among the numbered chapters; packs have none. */
  number?: number;
  /** The pack's id (`pack` on its tracks); absent for a numbered chapter. */
  pack?: string;
}

/**
 * Chapters of a catalog: consecutive tracks without a pack are cut into numbered chapters of
 * `size`; each run of one pack is a chapter of its own (cut by `size` too when it is longer).
 * Pack tracks are placed after the main catalog by the generator, so the numbered chapters come first.
 */
export function chaptersOf(tracks: readonly { pack?: string }[], size = CHAPTER_SIZE): Chapter[] {
  const out: Chapter[] = [];
  let numbered = 0;
  let i = 0;
  while (i < tracks.length) {
    const pack = tracks[i].pack;
    let end = i + 1;
    while (end < tracks.length && end - i < size && tracks[end].pack === pack) end++;
    out.push(pack ? { start: i, end, pack } : { start: i, end, number: ++numbered });
    i = end;
  }
  return out;
}

/** The chapters of the built-in catalog. */
export const CHAPTERS: readonly Chapter[] = chaptersOf(CATALOG);

/** The chapter holding catalog position `index` (undefined outside the catalog). */
export function chapterAt(index: number, chapters: readonly Chapter[] = CHAPTERS): Chapter | undefined {
  return chapters.find((c) => index >= c.start && index < c.end);
}

/** «Глава 3» / «Рок-пак» — the chapter row's tag, the pause menu and the result line. */
export function chapterTitle(chapter: Chapter): string {
  return chapter.pack ? (dict.packNames[chapter.pack] ?? chapter.pack) : fmt(dict.deckChapter, { n: chapter.number ?? 0 });
}
