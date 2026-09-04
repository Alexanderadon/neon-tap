export type { ChartFile, ChartLevel, NoteTuple, SectionTuple, SpellKind } from '@/shared/types/chart';
import type { SpellKind } from '@/shared/types/chart';

/** A note expanded from its tuple form, ready for the note pool. */
export interface ParsedNote {
  time: number;
  lane: number;
  /** 0 for tap notes. */
  duration: number;
  spell: SpellKind | null;
  /** Lane count of the section this note belongs to. */
  lanes: number;
}

/** A resolved lane-count section. */
export interface Section {
  time: number;
  lanes: number;
}
