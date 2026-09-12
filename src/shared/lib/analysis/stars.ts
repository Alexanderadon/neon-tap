import type { ChartLevel, NoteKind, NoteTuple, SectionTuple } from '@/shared/types/chart';
import type { Slot } from './SongAnalyzer';
import { round3, type Event } from './bars';

/** Lane-less tuples of the current events — enough for a provisional difficulty rating. */
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

/** Star-rating weights: felt difficulty = density first, then speed of hands, width of the field, mechanics, tempo. */
const STAR_W = {
  nps: 2.3,
  sixteenths: 2.0,
  peak: 0.3,
  wide: 1.2,
  special: 2.5,
  chords: 1.5,
  tempo: 0.6,
  offset: -2.2,
} as const;

/**
 * Difficulty rating 1–10 = felt difficulty: notes per second (dominant), share of sixteenth gaps,
 * peak 2-second density above the average, share of the song played on ≥ 5 lanes, share of
 * slides / rolls / circles, chord share and tempo. Calibrated so the easiest catalog track is
 * ★2–3 and the hardest ★8–9.
 */
export function rateStars(notes: readonly NoteTuple[], bpm = 120, sections?: readonly SectionTuple[]): number {
  if (notes.length < 2) return 1;
  const f = starFeatures(notes, bpm, sections);
  const raw =
    f.nps * STAR_W.nps +
    f.share16 * STAR_W.sixteenths +
    Math.max(0, f.peak - f.nps) * STAR_W.peak +
    f.wide * STAR_W.wide +
    f.special * STAR_W.special +
    f.chords * STAR_W.chords +
    f.tempo * STAR_W.tempo +
    STAR_W.offset;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

/** The measurable ingredients of felt difficulty (see `rateStars`). */
export interface StarFeatures {
  /** Notes per second over the charted span. */
  nps: number;
  /** Share of gaps between note times that are a sixteenth (or less). */
  share16: number;
  /** Densest 2-second window, in notes per second. */
  peak: number;
  /** Share of the charted span played on ≥ 5 lanes. */
  wide: number;
  /** Share of slides, rolls and circles. */
  special: number;
  /** Share of notes that are the second voice of a chord. */
  chords: number;
  /** Tempo 100–180 BPM mapped to 0..1. */
  tempo: number;
}

export function starFeatures(notes: readonly NoteTuple[], bpm = 120, sections?: readonly SectionTuple[]): StarFeatures {
  const times = [...new Set(notes.map((n) => n[0]))].sort((a, b) => a - b);
  if (times.length < 2)
    return {
      nps: 0,
      share16: 0,
      peak: 0,
      wide: 0,
      special: 0,
      chords: 0,
      tempo: 0,
    };
  const span = Math.max(1, times[times.length - 1] - times[0]);
  const avgNps = notes.length / span;
  const sixteenth = 15 / Math.max(60, bpm);
  let fast = 0;
  for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] <= sixteenth * 1.25) fast++;
  const share16 = times.length > 1 ? fast / (times.length - 1) : 0;
  let peak = 0;
  let j = 0;
  for (let i = 0; i < times.length; i++) {
    while (times[i] - times[j] > 2) j++;
    peak = Math.max(peak, (i - j + 1) / 2);
  }
  let wide = 0;
  if (sections && sections.length) {
    const first = times[0];
    const last = times[times.length - 1];
    for (let i = 0; i < sections.length; i++) {
      const from = Math.max(first, sections[i][0]);
      const to = Math.min(last, i + 1 < sections.length ? sections[i + 1][0] : last);
      if (sections[i][1] >= 5 && to > from) wide += to - from;
    }
    wide /= span;
  }
  const special = notes.filter((n) => n[3] === 'slide' || n[3] === 'roll' || n[3] === 'circle').length / notes.length;
  const chords = (notes.length - times.length) / notes.length;
  const tempo = Math.max(0, Math.min(1, (bpm - 100) / 80));
  return { nps: avgNps, share16, peak, wide, special, chords, tempo };
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
