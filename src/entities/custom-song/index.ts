/**
 * The player's own songs («Моя музыка»): saved on this device in IndexedDB (meta, chart, original
 * file), listed from a synchronous in-memory store, each with its own record.
 */
export {
  CUSTOM_FREE_LIMIT,
  songLimit,
  MAX_FILE_BYTES,
  MIN_DURATION_SEC,
  MAX_DURATION_SEC,
  TITLE_MAX,
  songIdOf,
  songLengthProblem,
  songKey,
  cleanTitle,
  titleFromFileName,
  songTitle,
  newSong,
  renamedMeta,
  bestOfRun,
  mergeBest,
} from './model/song';
export {
  songsStore,
  SONGS_COUNT_KEY,
  whenSongsLoaded,
  setSongRepo,
  refreshSongs,
  songStorageAvailable,
  findSong,
  savedSongIds,
  addSong,
  removeSong,
  renameSong,
  touchPlayed,
  saveBest,
  loadSongData,
  useSongs,
  useSongCount,
  useSong,
} from './model/songsStore';
export type { SongsState, SongsStatus } from './model/songsStore';
export { idbRepo, SONGS_DB } from './model/idbRepo';
export { memoryRepo } from './model/memoryRepo';
export type { SongMeta, SongBest, NewSong, AddOutcome, SongPatch, SongRepo } from './model/types';
