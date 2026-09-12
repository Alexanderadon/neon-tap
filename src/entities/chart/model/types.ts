export type { ChartFile, ChartLevel, NoteTuple, SectionTuple, NoteKind, SpellKind } from '@/shared/types/chart';
import type { NoteKind } from '@/shared/types/chart';

/** A note expanded from its tuple form, ready for the note pool. */
export interface ParsedNote {
  time: number;
  lane: number;
  /** 0 for tap notes. */
  duration: number;
  kind: NoteKind | null;
  /** For circles: 1-based position inside its combo group. 0 otherwise. */
  seq: number;
  /** For rolls: required tap count. For slides: end lane. 0 otherwise. */
  extra: number;
  /** Lane count of the section this note belongs to. */
  lanes: number;
  /** Melody note the tile plays when hit (MIDI), 0 = none. */
  pitch: number;
}

/** A resolved lane-count section. */
export interface Section {
  time: number;
  lanes: number;
}
