import type { Difficulty } from '@/shared/config/constants';

/**
 * Special note kinds. `slow` / `heart` are spells (catch = power-up);
 * `circle` is an osu!-style hit circle: it sits still on the playfield while an approach
 * ring shrinks onto it — tap when they meet (same timing windows as a lane note).
 */
export type NoteKind = 'slow' | 'heart' | 'circle';
/** @deprecated alias kept for readability where only spells are meant. */
export type SpellKind = 'slow' | 'heart';

/**
 * `[timeSec, lane]` tap, `[timeSec, lane, durationSec]` hold,
 * `[timeSec, lane, 0, kind]` special note (spell or circle).
 */
export type NoteTuple = [number, number] | [number, number, number] | [number, number, number, NoteKind];

/** `[timeSec, laneCount]` — from this time on the playfield has `laneCount` lanes. */
export type SectionTuple = [number, number];

export interface ChartLevel {
  stars: number;
  notes: NoteTuple[];
  /** Lane-count sections, ascending; the first starts at 0. Absent → 4 lanes throughout. */
  sections?: SectionTuple[];
}

export interface ChartFile {
  id: string;
  title: string;
  artist: string;
  license: string;
  sourceUrl: string;
  audio: string;
  bpm: number;
  /** Seconds to the first downbeat. */
  offset: number;
  duration: number;
  /** Tracked beat times in seconds (starting on a downbeat); drives the background pulse. */
  beats?: number[];
  charts: Record<Difficulty, ChartLevel>;
}
