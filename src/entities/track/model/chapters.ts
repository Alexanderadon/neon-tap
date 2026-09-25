import { dict, fmt } from '@/shared/i18n';
import { CATALOG } from './catalog';

/** Tracks per numbered chapter — the progress segments above the deck. */
export const CHAPTER_SIZE = 10;

/** A run of catalog positions shown as one chapter row: «ГЛАВА N», a named pack («РОК-ПАК»), «ПРЕМИУМ» or «НОВИНКИ». */
export interface Chapter {
  /** First catalog position. */
  start: number;
  /** One past the last catalog position. */
  end: number;
  /** 1-based number among the numbered chapters; named chapters have none. */
  number?: number;
  /** The pack's id (`pack` on its tracks); absent for a numbered chapter. */
  pack?: string;
  /** The premium tracks' chapter or the weekly tracks' («Новинки»); absent for numbered chapters and packs. */
  kind?: 'premium' | 'drops';
}

/** What a chapter is cut by: the registry flags of a track. */
export interface ChapterTrack {
  pack?: string;
  premium?: boolean;
  drop?: boolean;
}

/** The named run a track belongs to: weekly tracks, a pack, the premium tracks, or none (numbered). */
function groupOf(t: ChapterTrack): string | undefined {
  if (t.drop === true) return 'kind:drops';
  if (t.pack) return `pack:${t.pack}`;
  if (t.premium === true) return 'kind:premium';
  return undefined;
}

/**
 * Chapters of a catalog: consecutive road tracks are cut into numbered chapters of `size`; each run
 * of one pack, of premium tracks or of weekly tracks is a named chapter of its own (cut by `size`
 * too when it is longer). The generator puts premium tracks after the road, then the packs, then
 * the weekly tracks by date, so the numbered chapters come first and «Новинки» last.
 */
export function chaptersOf(tracks: readonly ChapterTrack[], size = CHAPTER_SIZE): Chapter[] {
  const out: Chapter[] = [];
  let numbered = 0;
  let i = 0;
  while (i < tracks.length) {
    const group = groupOf(tracks[i]);
    let end = i + 1;
    while (end < tracks.length && end - i < size && groupOf(tracks[end]) === group) end++;
    const t = tracks[i];
    if (group === undefined) out.push({ start: i, end, number: ++numbered });
    else if (group === 'kind:drops') out.push({ start: i, end, kind: 'drops' });
    else if (group === 'kind:premium') out.push({ start: i, end, kind: 'premium' });
    else out.push({ start: i, end, pack: t.pack });
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

/** «Глава 3» / «Рок-пак» / «Премиум» / «Новинки» — the chapter row's tag, the pause menu and the result line. */
export function chapterTitle(chapter: Chapter): string {
  if (chapter.kind === 'drops') return dict.dropsChapter;
  if (chapter.kind === 'premium') return dict.shopPremium;
  return chapter.pack ? (dict.packNames[chapter.pack] ?? chapter.pack) : fmt(dict.deckChapter, { n: chapter.number ?? 0 });
}
