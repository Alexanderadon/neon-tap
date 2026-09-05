import type { ParsedNote, Section } from '@/entities/chart';
import type { Judgement, ResultTimeline, TimeRange } from '@/entities/score';

/** Seconds a note takes to fall from the top of the mini field to the hit line. */
export const REPLAY_APPROACH = 1.4;
/** A recorded judgement is attached to the closest note head/tail within this distance, seconds (earliest wins ties). */
const MATCH_WINDOW = 0.25;

export const JUDGEMENT_CODE: Record<Judgement, number> = { perfect: 0, great: 1, good: 2, miss: 3 };

/**
 * Everything the best-moment replay needs, in flat typed arrays so the animation frame touches
 * no objects. Notes are the chart notes visible at some point of the range (sorted by time);
 * events are the recorded judgements inside the range, each attached to a note head or tail.
 */
export interface ReplayData {
  range: TimeRange;
  noteCount: number;
  noteTime: Float64Array;
  noteEnd: Float64Array;
  noteLane: Int8Array;
  noteLanes: Int8Array;
  /** 1 = circle (drawn as a ring), 0 = everything else. */
  noteCircle: Uint8Array;
  /** Recorded hit time of the head, or +Infinity when the head was never hit (missed / outside the record). */
  noteHit: Float64Array;
  /** Recorded tail judgement time for holds, or +Infinity. */
  noteTailHit: Float64Array;
  eventCount: number;
  eventTime: Float64Array;
  /** Lane of the flash; -1 when the judgement could not be matched to a note. */
  eventLane: Int8Array;
  eventLanes: Int8Array;
  eventCode: Uint8Array;
  /** Lane counts that appear among the replay notes (for sprite pre-rendering). */
  laneCounts: number[];
  /** Section switch times / lane counts for the field geometry. */
  sectionTime: Float64Array;
  sectionLanes: Int8Array;
}

/** Build the replay arrays for `range` (pure, one-off). */
export function buildReplay(notes: readonly ParsedNote[], sections: readonly Section[], timeline: ResultTimeline, range: TimeRange): ReplayData {
  const visibleFrom = range.from - REPLAY_APPROACH;
  const picked: ParsedNote[] = [];
  for (const n of notes) {
    if (n.time > range.to + 0.05) break;
    if (n.time + n.duration >= visibleFrom) picked.push(n);
  }
  const nc = picked.length;
  const noteTime = new Float64Array(nc);
  const noteEnd = new Float64Array(nc);
  const noteLane = new Int8Array(nc);
  const noteLanes = new Int8Array(nc);
  const noteCircle = new Uint8Array(nc);
  const noteHit = new Float64Array(nc).fill(Number.POSITIVE_INFINITY);
  const noteTailHit = new Float64Array(nc).fill(Number.POSITIVE_INFINITY);
  const laneSet = new Set<number>();
  for (let i = 0; i < nc; i++) {
    const n = picked[i];
    noteTime[i] = n.time;
    noteEnd[i] = n.time + n.duration;
    noteLane[i] = n.lane;
    noteLanes[i] = n.lanes;
    noteCircle[i] = n.kind === 'circle' ? 1 : 0;
    laneSet.add(n.lanes);
  }

  const evIdx: number[] = [];
  for (let i = 0; i < timeline.t.length; i++) {
    const t = timeline.t[i];
    if (t < visibleFrom) continue;
    if (t > range.to + MATCH_WINDOW) break;
    evIdx.push(i);
  }
  const ec = evIdx.length;
  const eventTime = new Float64Array(ec);
  const eventLane = new Int8Array(ec).fill(-1);
  const eventLanes = new Int8Array(ec).fill(4);
  const eventCode = new Uint8Array(ec);
  const headUsed = new Uint8Array(nc);
  const tailUsed = new Uint8Array(nc);
  for (let e = 0; e < ec; e++) {
    const t = timeline.t[evIdx[e]];
    eventTime[e] = t;
    eventCode[e] = JUDGEMENT_CODE[timeline.j[evIdx[e]]];
    let best = -1;
    let bestTail = false;
    let bestDist = MATCH_WINDOW + 1e-9;
    for (let k = 0; k < nc; k++) {
      if (noteTime[k] - t > MATCH_WINDOW) break;
      if (!headUsed[k]) {
        const d = Math.abs(noteTime[k] - t);
        if (d < bestDist) {
          bestDist = d;
          best = k;
          bestTail = false;
        }
      } else if (noteEnd[k] > noteTime[k] && !tailUsed[k]) {
        const d = Math.abs(noteEnd[k] - t);
        if (d < bestDist) {
          bestDist = d;
          best = k;
          bestTail = true;
        }
      }
    }
    if (best < 0) continue;
    const n = picked[best];
    if (bestTail) {
      tailUsed[best] = 1;
      noteTailHit[best] = t;
      eventLane[e] = n.kind === 'slide' ? n.extra : n.lane;
    } else {
      headUsed[best] = 1;
      noteHit[best] = t;
      eventLane[e] = n.lane;
    }
    eventLanes[e] = n.lanes;
  }

  const sectionTime = new Float64Array(sections.length);
  const sectionLanes = new Int8Array(sections.length);
  for (let i = 0; i < sections.length; i++) {
    sectionTime[i] = sections[i].time;
    sectionLanes[i] = sections[i].lanes;
  }
  if (laneSet.size === 0) laneSet.add(sections[0]?.lanes ?? 4);

  return {
    range,
    noteCount: nc,
    noteTime,
    noteEnd,
    noteLane,
    noteLanes,
    noteCircle,
    noteHit,
    noteTailHit,
    eventCount: ec,
    eventTime,
    eventLane,
    eventLanes,
    eventCode,
    laneCounts: [...laneSet].sort((a, b) => a - b),
    sectionTime,
    sectionLanes,
  };
}

/** Lane count active at `t` (no allocation — a linear scan over the few sections). */
export function replayLanesAt(data: ReplayData, t: number): number {
  let lanes = data.sectionLanes.length ? data.sectionLanes[0] : 4;
  for (let i = 0; i < data.sectionTime.length; i++) {
    if (data.sectionTime[i] <= t + 1e-9) lanes = data.sectionLanes[i];
    else break;
  }
  return lanes;
}
