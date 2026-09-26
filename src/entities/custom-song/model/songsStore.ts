import { createStore, useStore } from '@/shared/lib/store/createStore';
import { hasIndexedDb } from '@/shared/lib/idb';
import { now } from '@/shared/lib/time';
import type { ChartFile } from '@/shared/types/chart';
import { idbRepo } from './idbRepo';
import { renamedMeta } from './song';
import type { AddOutcome, NewSong, SongBest, SongMeta, SongRepo } from './types';

export type SongsStatus = 'loading' | 'ready' | 'unavailable';

export interface SongsState {
  /** `unavailable`: no IndexedDB (or it failed to open) — songs play once and are not kept. */
  status: SongsStatus;
  /** Every saved song's meta, oldest first. */
  songs: readonly SongMeta[];
  /** The database came up empty although this device had saved songs: the browser cleared its storage. */
  evicted: boolean;
}

/** How many songs were saved at the last look (localStorage survives some of the cases where IndexedDB is wiped). */
export const SONGS_COUNT_KEY = 'neon-tap:songs-count';

function readSavedCount(): number {
  try {
    const n = Number(localStorage.getItem(SONGS_COUNT_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeSavedCount(n: number): void {
  try {
    localStorage.setItem(SONGS_COUNT_KEY, String(n));
  } catch {
    /* storage unavailable */
  }
}

let repo: SongRepo | null = hasIndexedDb() ? idbRepo() : null;

/**
 * The saved songs' meta, held in memory so the list, the deck's counter and the result screen read
 * it synchronously. It loads on the first import of this slice; writes go to the repo first and
 * land here when they succeed (the play time and the record are written here at once).
 */
export const songsStore = createStore<SongsState>({ status: repo ? 'loading' : 'unavailable', songs: [], evicted: false });

let lastWrittenCount = -1;
songsStore.subscribe(() => {
  const s = songsStore.get();
  if (s.status !== 'ready' || s.songs.length === lastWrittenCount) return;
  lastWrittenCount = s.songs.length;
  writeSavedCount(s.songs.length);
});

const byCreated = (a: SongMeta, b: SongMeta) => a.createdAt - b.createdAt;

/**
 * A first load that has not answered by then counts as no storage (some Safari versions never
 * settle `indexedDB.open`): songs play once instead of the screen waiting forever. A late answer
 * still makes the list ready.
 */
const LOAD_GIVE_UP_MS = 4000;

async function load(r: SongRepo): Promise<void> {
  const giveUp = setTimeout(() => {
    if (r === repo && songsStore.get().status === 'loading') songsStore.set({ status: 'unavailable' });
  }, LOAD_GIVE_UP_MS);
  try {
    const songs = (await r.list()).sort(byCreated);
    if (r !== repo) return;
    const evicted = songs.length === 0 && readSavedCount() > 0;
    songsStore.set({ status: 'ready', songs, evicted });
  } catch (err) {
    if (r !== repo) return;
    console.warn('songs: storage unavailable', err);
    repo = null;
    songsStore.set({ status: 'unavailable', songs: [], evicted: false });
  } finally {
    clearTimeout(giveUp);
  }
}

let loading: Promise<void> = repo ? load(repo) : Promise.resolve();

/** Resolves once the first load has finished (ready or unavailable). */
export async function whenSongsLoaded(): Promise<SongsState> {
  await loading;
  return songsStore.get();
}

/** Swap the storage (tests pass a `memoryRepo`; `null` = no storage) and load from it. */
export function setSongRepo(next: SongRepo | null): Promise<void> {
  repo = next;
  lastWrittenCount = -1;
  songsStore.set({ status: next ? 'loading' : 'unavailable', songs: [], evicted: false });
  loading = next ? load(next) : Promise.resolve();
  return loading;
}

/** Load the list again from the storage (another tab may have changed it). */
export function refreshSongs(): Promise<void> {
  if (!repo) return Promise.resolve();
  loading = load(repo);
  return loading;
}

/** Songs can be saved on this device (after the first load; a load that gave up says no until it answers). */
export function songStorageAvailable(): boolean {
  return repo !== null && songsStore.get().status !== 'unavailable';
}

/** A saved song's meta, synchronously. */
export function findSong(id: string): SongMeta | undefined {
  return songsStore.get().songs.find((s) => s.id === id);
}

function replaceSong(meta: SongMeta): void {
  songsStore.set((s) => ({ songs: s.songs.map((x) => (x.id === meta.id ? meta : x)) }));
}

function dropSong(id: string): void {
  songsStore.set((s) => ({ songs: s.songs.filter((x) => x.id !== id) }));
}

/** The storage, or an error when there is none (callers check `songStorageAvailable` first). */
function storage(): SongRepo {
  if (!repo) throw new Error('song storage unavailable');
  return repo;
}

/** The songs saved in the storage right now (not the in-memory list): the quota's authoritative count. */
export async function savedSongIds(): Promise<string[]> {
  return (await storage().list()).map((s) => s.id);
}

/**
 * Save a song unless it is already saved or `limit` songs are (`null` = no limit). The check and
 * the write are one transaction. Throws on storage errors (a full disk: `QuotaExceededError`).
 */
export async function addSong(song: NewSong, limit: number | null): Promise<AddOutcome> {
  const outcome = await storage().add(song, limit);
  if (outcome === 'ok') songsStore.set((s) => ({ songs: [...s.songs.filter((x) => x.id !== song.meta.id), song.meta], evicted: false }));
  else if (outcome === 'duplicate' && !findSong(song.meta.id)) await refreshSongs();
  return outcome;
}

/** Delete a song with its chart, audio and record. */
export async function removeSong(id: string): Promise<void> {
  await storage().remove(id);
  dropSong(id);
}

/** Rename a song; false when the title is blank or the song is gone. */
export async function renameSong(id: string, title: string): Promise<boolean> {
  const current = findSong(id);
  const next = current ? renamedMeta(current, title) : null;
  if (!next) return false;
  const saved = await storage().update(id, { title: next.title, titleKey: next.titleKey });
  if (!saved) {
    dropSong(id);
    return false;
  }
  replaceSong(saved);
  return true;
}

/**
 * A new chart for a saved song («Сложнее»): the chart (with the song's id, title and artist) and the meta's
 * stars, note count and generator version are written in one transaction, then the list shows them.
 * False when the song is gone (deleted in another tab). Throws on storage errors.
 */
export async function replaceSongChart(id: string, chart: ChartFile, generatorVersion: number): Promise<boolean> {
  const current = findSong(id);
  const stored: ChartFile = { ...chart, id, title: current?.title ?? chart.title, artist: current?.artist ?? chart.artist };
  const saved = await storage().replaceChart(id, stored, { stars: chart.chart.stars, notes: chart.chart.notes.length, generatorVersion });
  if (!saved) {
    dropSong(id);
    return false;
  }
  replaceSong(saved);
  return true;
}

/** Remember that the song was just played (the «Недавние» order). */
export function touchPlayed(id: string, at: number = now()): void {
  const current = findSong(id);
  if (!current) return;
  replaceSong({ ...current, lastPlayedAt: at });
  repo?.update(id, { lastPlayedAt: at }).catch((err: unknown) => console.warn('songs: play time not saved', err));
}

/**
 * Store a new record: in memory at once (the result screen reads it synchronously), in the
 * storage in the background. A song deleted meanwhile (another tab) gets no record back.
 */
export function saveBest(id: string, best: SongBest): Promise<boolean> {
  const current = findSong(id);
  if (!current || !repo) return Promise.resolve(false);
  replaceSong({ ...current, best });
  return repo
    .update(id, { best })
    .then((saved) => {
      if (!saved) dropSong(id);
      return !!saved;
    })
    .catch((err: unknown) => {
      console.warn('songs: record not saved', err);
      return false;
    });
}

/** The chart and the file of a saved song (its current title applied), or null when it is gone. */
export async function loadSongData(id: string): Promise<{ meta: SongMeta; chart: ChartFile; audio: Blob } | null> {
  const r = storage();
  const [meta, chart, audio] = await Promise.all([r.get(id), r.chart(id), r.audio(id)]);
  if (!meta || !chart || !audio) return null;
  return { meta, chart: { ...chart, id, title: meta.title, artist: meta.artist }, audio };
}

export function useSongs<R>(selector: (s: SongsState) => R): R {
  return useStore(songsStore, selector);
}

/** How many songs are saved on this device. */
export function useSongCount(): number {
  return useStore(songsStore, (s) => s.songs.length);
}

/** One saved song's meta (undefined when not saved). */
export function useSong(id: string | null | undefined): SongMeta | undefined {
  return useStore(songsStore, (s) => (id ? s.songs.find((x) => x.id === id) : undefined));
}
