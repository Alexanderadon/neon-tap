import { blobFingerprint } from '@/shared/lib/hash';
import { CUSTOM_ID_PREFIX, type ChartFile } from '@/shared/types/chart';
import { RANK_ORDER, type PlayResult } from '@/shared/types/result';
import type { NewSong, SongBest, SongMeta } from './types';

/** Saved songs a player without NEON PASS may keep. */
export const CUSTOM_FREE_LIMIT = 3;

/** Songs that may be saved: three without NEON PASS, no limit with it (`null`). Deleting a song frees its slot. */
export function songLimit(pass: boolean): number | null {
  return pass ? null : CUSTOM_FREE_LIMIT;
}
/** Files above this size are refused before anything is read. */
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
/**
 * Decoded songs shorter or longer than this are refused. A level needs a song; memory bounds the top:
 * decoded audio is Float32 per channel — ≈21 MB per stereo minute at 44.1 kHz, ≈23 MB at 48 kHz — so
 * 12 minutes hold ≈250–280 MB, plus ≈70 MB for the analysis mixdown.
 */
export const MIN_DURATION_SEC = 30;
export const MAX_DURATION_SEC = 12 * 60;
/** Titles and artists are cut to this many characters. */
export const TITLE_MAX = 60;

/** The id of a song file: `custom:` + 20 hex of SHA-256(first 2 MB ‖ size) — renaming the file keeps it. */
export async function songIdOf(file: Blob): Promise<string> {
  return CUSTOM_ID_PREFIX + (await blobFingerprint(file));
}

/**
 * The header's duration (`probeDuration`, before decoding) says the song is too long. A little slack:
 * a VBR MP3 without a Xing header is estimated, and the exact check follows the decoding anyway.
 */
export function probedTooLong(approxSec: number | null): boolean {
  return approxSec !== null && approxSec > MAX_DURATION_SEC * 1.05;
}

/** Too short, too long or fine. */
export function songLengthProblem(durationSec: number): 'short' | 'long' | null {
  if (!(durationSec >= MIN_DURATION_SEC)) return 'short';
  if (durationSec > MAX_DURATION_SEC) return 'long';
  return null;
}

/** The search key: lower case, ё → е, single spaces. */
export function songKey(text: string): string {
  return text.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/** One line of at most `TITLE_MAX` characters: no control characters, single spaces, trimmed. */
export function cleanTitle(raw: string | null | undefined): string {
  if (!raw) return '';
  let out = '';
  for (const ch of raw) {
    const c = ch.charCodeAt(0);
    out += c < 0x20 || c === 0x7f ? ' ' : ch;
  }
  const chars = Array.from(out.replace(/\s+/g, ' ').trim());
  return chars.slice(0, TITLE_MAX).join('').trim();
}

/** File name without its extension, underscores read as spaces («01_my_song.mp3» → «01 my song»). */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.\\/]{1,5}$/, '') || name;
  return cleanTitle(base.replace(/_/g, ' '));
}

/** Title and artist of a new song: the file's tags, else its name. */
export function songTitle(tags: { title?: string; artist?: string }, fileName: string): { title: string; artist: string } {
  return { title: cleanTitle(tags.title) || titleFromFileName(fileName) || fileName.slice(0, TITLE_MAX), artist: cleanTitle(tags.artist) };
}

interface NewSongInput {
  id: string;
  chart: ChartFile;
  audio: Blob;
  title: string;
  artist: string;
  generatorVersion: number;
  createdAt: number;
}

/** Put a generated chart and its file together as a song to save (the chart takes the song's id and names). */
export function newSong({ id, chart, audio, title, artist, generatorVersion, createdAt }: NewSongInput): NewSong {
  const stored: ChartFile = { ...chart, id, title, artist };
  const meta: SongMeta = {
    id,
    title,
    artist,
    titleKey: songKey(title),
    durationSec: Math.round(chart.duration * 10) / 10,
    bpm: Math.round(chart.bpm),
    stars: chart.chart.stars,
    notes: chart.chart.notes.length,
    generatorVersion,
    createdAt,
    lastPlayedAt: null,
  };
  return { meta, chart: stored, audio };
}

/** The song's meta after a rename: the title and its search key, `null` when the new title is blank. */
export function renamedMeta(meta: SongMeta, rawTitle: string): SongMeta | null {
  const title = cleanTitle(rawTitle);
  return title ? { ...meta, title, titleKey: songKey(title) } : null;
}

/** The record candidate of a finished run. */
export function bestOfRun(result: PlayResult, playedAt: string): SongBest {
  return {
    score: result.score,
    accuracy: result.accuracy,
    rank: result.rank,
    maxCombo: result.maxCombo,
    fullCombo: result.fullCombo,
    stars: result.stars,
    crowns: result.crowns,
    playedAt,
  };
}

/**
 * Merge a run into the record, like the catalog does: a higher score replaces the record; stars,
 * crowns, full combo and rank only ever grow.
 */
export function mergeBest(prev: SongBest | undefined, run: SongBest): { best: SongBest; newRecord: boolean } {
  if (!prev) return { best: run, newRecord: true };
  const newRecord = run.score > prev.score;
  const base = newRecord ? run : prev;
  const rank = RANK_ORDER[Math.max(RANK_ORDER.indexOf(prev.rank), RANK_ORDER.indexOf(run.rank), 0)];
  return {
    best: {
      ...base,
      rank: newRecord ? run.rank : rank,
      stars: Math.max(prev.stars, run.stars),
      crowns: Math.max(prev.crowns, run.crowns),
      fullCombo: prev.fullCombo || run.fullCombo,
    },
    newRecord,
  };
}
