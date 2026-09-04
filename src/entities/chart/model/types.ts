export type { ChartFile, ChartLevel, NoteTuple } from '@/shared/types/chart';

/** A note expanded from its tuple form, ready for the note pool. */
export interface ParsedNote {
  time: number;
  lane: number;
  /** 0 for tap notes. */
  duration: number;
}
