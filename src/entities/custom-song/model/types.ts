import type { ChartFile } from '@/shared/types/chart';
import type { Rank } from '@/shared/types/result';

/**
 * The best run on one of the player's own songs. It lives with the song (IndexedDB `meta`), never
 * in `SaveData.tracks`: own songs must not count towards the catalog's badges, «пройдено X / N» or
 * the reset dialog, and deleting the song deletes its record.
 */
export interface SongBest {
  score: number;
  accuracy: number;
  rank: Rank;
  maxCombo: number;
  fullCombo: boolean;
  /** Most levels finished in one run (0–3), a star each. */
  stars: number;
  /** Most endless loops finished past the third level in one run, a crown each. */
  crowns: number;
  /** ISO time of the record run. */
  playedAt: string;
}

/** What the list needs about a saved song (≈400 bytes; the chart and the audio are stored apart). */
export interface SongMeta {
  /** `custom:` + 20 hex of the file's fingerprint (see `songIdOf`). */
  id: string;
  title: string;
  artist: string;
  /** The title in lower case with ё → е: what the search compares. */
  titleKey: string;
  durationSec: number;
  bpm: number;
  /** Difficulty 1–10 of the generated chart. */
  stars: number;
  /** Notes in the chart. */
  notes: number;
  /** The chart generator that made the chart (`GENERATOR_VERSION` of features/generate-chart). */
  generatorVersion: number;
  /** ms since the epoch. */
  createdAt: number;
  lastPlayedAt: number | null;
  best?: SongBest;
}

/** A song ready to be saved: the list entry, the chart and the original file. */
export interface NewSong {
  meta: SongMeta;
  chart: ChartFile;
  audio: Blob;
}

/** How an add ended: saved, already there (same fingerprint) or no free slot. */
export type AddOutcome = 'ok' | 'duplicate' | 'limit';

/** The fields a saved song may change. */
export type SongPatch = Partial<Pick<SongMeta, 'title' | 'artist' | 'titleKey' | 'lastPlayedAt' | 'best'>>;

/** What a new chart of a saved song changes in its meta («Сложнее»). */
export type ChartPatch = Pick<SongMeta, 'stars' | 'notes' | 'generatorVersion'>;

/**
 * Storage of the player's songs. `idbRepo` keeps them in IndexedDB, `memoryRepo` in a map (tests).
 * Every method is one transaction; `add` checks the duplicate and the slot count and writes in the
 * same one, so two tabs adding at once cannot pass the limit together.
 */
export interface SongRepo {
  /** Every song's meta (the list never reads charts or audio). */
  list(): Promise<SongMeta[]>;
  count(): Promise<number>;
  get(id: string): Promise<SongMeta | undefined>;
  /** Save unless the id is already there or `limit` songs are saved (`null` = no limit). Throws on storage errors (a full disk). */
  add(song: NewSong, limit: number | null): Promise<AddOutcome>;
  chart(id: string): Promise<ChartFile | undefined>;
  audio(id: string): Promise<Blob | undefined>;
  /** Merge the patch into a saved song; `undefined` when the song is gone (deleted in another tab) — nothing is written then. */
  update(id: string, patch: SongPatch): Promise<SongMeta | undefined>;
  /** Store a new chart for a saved song and its meta's stars / notes / generator in the same transaction; `undefined` (nothing written) when the song is gone. */
  replaceChart(id: string, chart: ChartFile, patch: ChartPatch): Promise<SongMeta | undefined>;
  remove(id: string): Promise<void>;
}
