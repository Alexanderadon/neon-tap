/**
 * Special note kinds.
 *  - slow / heart: spells — catch (hit) the note to trigger the effect.
 *  - circle: osu!-style hit circle, tapped on screen (or Space), never a lane key.
 *  - roll: drum roll — tap the lane `extra` times before the bar runs out.
 *  - slide: a hold that travels to lane `extra`; keep the finger on it and slide.
 */
export type NoteKind = 'slow' | 'heart' | 'circle' | 'roll' | 'slide';
export type SpellKind = 'slow' | 'heart';

/**
 * `[timeSec, lane]` tap · `[timeSec, lane, durationSec]` hold ·
 * `[timeSec, lane, 0, 'slow' | 'heart' | 'circle']` special tap ·
 * `[timeSec, lane, durationSec, 'roll', taps]` drum roll ·
 * `[timeSec, lane, durationSec, 'slide', endLane]` slide hold.
 */
export type NoteTuple =
  | [number, number]
  | [number, number, number]
  | [number, number, number, NoteKind]
  | [number, number, number, NoteKind, number];

/** `[timeSec, laneCount]` — from this time on the playfield has `laneCount` lanes. */
export type SectionTuple = [number, number];

export interface ChartLevel {
  /** Difficulty rating 1–10 of the song itself. */
  stars: number;
  notes: NoteTuple[];
  /** Lane-count sections, ascending; the first starts at 0. Absent → 4 lanes throughout. */
  sections?: SectionTuple[];
}

/** Music genres of the built-in catalog — drive the cover art and (optionally) visual themes. */
export const GENRES = [
  'synthwave',
  'chiptune',
  'lofi',
  'rock',
  'orchestral',
  'jazz',
  'dnb',
  'techno',
  'ambient',
  'acoustic',
  'world',
  'electronic',
] as const;
export type Genre = (typeof GENRES)[number];

/**
 * Pseudo-genre of a dev-only local track (`assets-src/music-local` → `npm run assets:local`).
 * Deliberately not in `GENRES`: covers and themes fall back to their defaults for it.
 */
export const LOCAL_GENRE = 'local' as const;
export type TrackGenre = Genre | typeof LOCAL_GENRE;

export interface ChartFile {
  id: string;
  title: string;
  artist: string;
  license: string;
  sourceUrl: string;
  /** Genre tag from the track registry (or `'local'` for local tracks); absent for user-supplied songs. */
  genre?: TrackGenre;
  audio: string;
  bpm: number;
  /** Seconds to the first downbeat. */
  offset: number;
  duration: number;
  /** Tracked beat times in seconds (starting on a downbeat). */
  beats?: number[];
  /** One chart per song — the music decides how hard it is. */
  chart: ChartLevel;
}
