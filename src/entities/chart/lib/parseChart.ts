import { LANE_COUNT } from '@/shared/config/constants';
import type { ChartLevel, NoteTuple, ParsedNote } from '../model/types';

/** Validate + expand a chart level into sorted notes. Throws on malformed data. */
export function parseChartLevel(level: ChartLevel): ParsedNote[] {
  const notes = level.notes.map(parseNote);
  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  return notes;
}

function parseNote(t: NoteTuple, i: number): ParsedNote {
  const [time, lane, duration = 0] = t;
  if (!Number.isFinite(time) || time < 0) throw new Error(`note ${i}: bad time ${time}`);
  if (!Number.isInteger(lane) || lane < 0 || lane >= LANE_COUNT) throw new Error(`note ${i}: bad lane ${lane}`);
  if (!Number.isFinite(duration) || duration < 0) throw new Error(`note ${i}: bad duration ${duration}`);
  return { time, lane, duration };
}

/** Number of judgements a chart yields: holds count twice (head + tail). */
export function countJudgements(notes: readonly ParsedNote[]): number {
  let n = 0;
  for (const note of notes) n += note.duration > 0 ? 2 : 1;
  return n;
}
