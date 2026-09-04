import { LANE_COUNT, MAX_LANES, MIN_LANES } from '@/shared/config/constants';
import { lowerBound } from '@/shared/lib/math';
import type { ChartLevel, NoteTuple, ParsedNote, Section } from '../model/types';

const KINDS = ['slow', 'heart', 'circle'] as const;
/** Circles closer than this form one numbered group (1, 2, 3 …). */
const CIRCLE_GROUP_GAP = 2.5;

/** Validate the lane-count sections of a level (defaults to a single 4-lane section). */
export function parseSections(level: ChartLevel): Section[] {
  const raw = level.sections?.length ? level.sections : [[0, LANE_COUNT] as [number, number]];
  const sections = raw.map(([time, lanes], i) => {
    if (!Number.isFinite(time) || time < 0) throw new Error(`section ${i}: bad time ${time}`);
    if (!Number.isInteger(lanes) || lanes < MIN_LANES || lanes > MAX_LANES) throw new Error(`section ${i}: bad lane count ${lanes}`);
    return { time, lanes };
  });
  sections.sort((a, b) => a.time - b.time);
  if (sections[0].time > 0) sections.unshift({ time: 0, lanes: sections[0].lanes });
  return sections;
}

/** Lane count active at `time`. */
export function lanesAt(sections: readonly Section[], time: number): number {
  const times = sections.map((s) => s.time);
  const i = Math.max(0, lowerBound(times, time + 1e-9) - 1);
  return sections[i].lanes;
}

/** Validate + expand a chart level into sorted notes. Throws on malformed data. */
export function parseChartLevel(level: ChartLevel): ParsedNote[] {
  const sections = parseSections(level);
  const notes = level.notes.map((t, i) => parseNote(t, i, lanesAt(sections, t[0])));
  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  // Number circle groups.
  let lastCircle = -Infinity;
  let seq = 0;
  for (const n of notes) {
    if (n.kind !== 'circle') continue;
    seq = n.time - lastCircle <= CIRCLE_GROUP_GAP ? seq + 1 : 1;
    n.seq = seq;
    lastCircle = n.time;
  }
  return notes;
}

function parseNote(t: NoteTuple, i: number, lanes: number): ParsedNote {
  const [time, lane, duration = 0, kind] = t;
  if (!Number.isFinite(time) || time < 0) throw new Error(`note ${i}: bad time ${time}`);
  if (!Number.isInteger(lane) || lane < 0 || lane >= lanes) throw new Error(`note ${i}: lane ${lane} outside ${lanes}-lane section`);
  if (!Number.isFinite(duration) || duration < 0) throw new Error(`note ${i}: bad duration ${duration}`);
  if (kind !== undefined && !KINDS.includes(kind)) throw new Error(`note ${i}: bad kind ${String(kind)}`);
  if (kind && duration > 0) throw new Error(`note ${i}: special notes cannot be holds`);
  return { time, lane, duration, kind: kind ?? null, seq: 0, lanes };
}

/** Number of judgements a chart yields: holds count twice (head + tail). */
export function countJudgements(notes: readonly ParsedNote[]): number {
  let n = 0;
  for (const note of notes) n += note.duration > 0 ? 2 : 1;
  return n;
}
