import type { Difficulty } from '@/shared/config/constants';

/** Power-ups attached to a note: catch it (hit it) to trigger the effect. */
export type SpellKind = 'slow' | 'heart';

/**
 * `[timeSec, lane]` tap, `[timeSec, lane, durationSec]` hold,
 * `[timeSec, lane, 0, spell]` spell note (a tap that grants a power-up).
 */
export type NoteTuple = [number, number] | [number, number, number] | [number, number, number, SpellKind];

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
