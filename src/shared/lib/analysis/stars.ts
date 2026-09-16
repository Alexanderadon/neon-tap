import type { ChartLevel, NoteKind, NoteTuple, SectionTuple } from '@/shared/types/chart';
import type { Slot } from './SongAnalyzer';
import { round3, type Event } from './bars';
import { rateStarsBudget } from './budget';

/** Lane-less tuples of the composer's events — what the rating's windows and the density checks read while the chart is being built. */
export function eventsToTuples(events: readonly Event[], slots: readonly Slot[]): NoteTuple[] {
  const out: NoteTuple[] = [];
  for (const e of events) {
    const time = round3(slots[e.si].time);
    const dur = e.hold > 0 ? round3(slots[Math.min(slots.length - 1, e.si + e.hold)].time - slots[e.si].time) : 0;
    if (e.kind === 'spin') {
      out.push([time, 0, dur, 'spin']);
      continue;
    }
    for (let k = 0; k < e.size; k++) {
      if (e.kind === 'roll') out.push([time, k, dur, 'roll', e.taps]);
      else if (e.kind === 'slide') out.push([time, k, dur, 'slide', k + 1]);
      else if (e.kind) out.push([time, k, 0, e.kind]);
      else if (dur > 0) out.push([time, k, dur]);
      else out.push([time, k]);
    }
  }
  return out;
}

/**
 * Difficulty rating ★1–6 = the smallest budget (`budget.ts`) every feature of the chart fits:
 * its densest 1 / 4 / 8 seconds, its tightest gap, its fullest bar, its widest field, its chords
 * and circles. 7 means it fits nothing — the composer never ships that. `barTimes` (bar starts
 * plus the end of the last bar) enable the per-bar counts.
 */
export function rateStars(notes: readonly NoteTuple[], bpm = 120, sections?: readonly SectionTuple[], barTimes?: readonly number[]): number {
  return rateStarsBudget(notes, bpm, sections, barTimes).stars;
}

/** Mechanic counts for the song card. */
export function chartFeatures(level: ChartLevel): {
  circles: number;
  spins: number;
  rolls: number;
  slides: number;
  holds: number;
  laneChanges: number;
} {
  const kind = (k: NoteKind) => level.notes.filter((n) => n[3] === k).length;
  return {
    circles: kind('circle'),
    spins: kind('spin'),
    rolls: kind('roll'),
    slides: kind('slide'),
    holds: level.notes.filter((n) => n.length === 3 && (n[2] as number) > 0).length,
    laneChanges: Math.max(0, (level.sections?.length ?? 1) - 1),
  };
}
