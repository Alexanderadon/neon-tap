import type { Difficulty } from '@/shared/config/constants';

/** `[timeSec, lane]` for tap notes, `[timeSec, lane, durationSec]` for hold notes. */
export type NoteTuple = [number, number] | [number, number, number];

export interface ChartLevel {
  stars: number;
  notes: NoteTuple[];
}

export interface ChartFile {
  id: string;
  title: string;
  artist: string;
  license: string;
  sourceUrl: string;
  audio: string;
  bpm: number;
  offset: number;
  duration: number;
  charts: Record<Difficulty, ChartLevel>;
}
