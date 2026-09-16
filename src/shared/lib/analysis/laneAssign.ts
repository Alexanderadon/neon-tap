import type { NoteTuple } from '@/shared/types/chart';
import type { Slot } from './SongAnalyzer';
import { round3, type Event } from './bars';

/** Circles cycle through this many screen positions across the whole field. */
const CIRCLE_SPREAD = 8;
/** Consecutive tiles this close (song seconds) are played by different thumbs and never in one lane (one judgement span). */
const FAST_SEC = 0.3;

type MotionKind = 'up' | 'down' | 'zigzag' | 'trill';

class Motion {
  private seq: number[];
  private pos = 0;
  constructor(kind: MotionKind, n: number, random: () => number) {
    const up = Array.from({ length: n }, (_, i) => i);
    switch (kind) {
      case 'up':
        this.seq = up;
        break;
      case 'down':
        this.seq = [...up].reverse();
        break;
      case 'zigzag': {
        const z = [...up.filter((l) => l % 2 === 0), ...up.filter((l) => l % 2 === 1)];
        this.seq = random() < 0.5 ? z : z.reverse();
        break;
      }
      case 'trill': {
        const left = up.filter((l) => l < n / 2);
        const right = up.filter((l) => l >= n / 2);
        this.seq = [left[Math.floor(random() * left.length)], right[Math.floor(random() * right.length)]];
        break;
      }
    }
  }

  next(candidates: readonly number[]): number {
    for (let tries = 0; tries < this.seq.length; tries++) {
      const lane = this.seq[(this.pos + tries) % this.seq.length];
      if (candidates.includes(lane)) {
        this.pos = (this.pos + tries + 1) % this.seq.length;
        return lane;
      }
    }
    return candidates[0];
  }
}

/**
 * Which thumb plays a lane on a phone held in both hands: 0 = left half, 1 = right half,
 * -1 = the middle lane of an odd count (either thumb). Every placement decision below is made
 * per hand, not per lane — a busy thumb (hold / roll / slide) takes its whole half with it.
 */
export function handOf(lane: number, n: number): -1 | 0 | 1 {
  const c = (lane + 0.5) / n;
  return c < 0.5 ? 0 : c > 0.5 ? 1 : -1;
}

/** Preferred chord shapes for `n` lanes: one lane per thumb — outer pair on downbeats, inner pair otherwise, then any two-hand pair. */
function chordPairs(n: number, down: boolean): number[][] {
  const outer = [0, n - 1];
  const m = Math.floor(n / 2);
  const inner = n % 2 === 0 ? [m - 1, m] : [m - 1, m + 1];
  const pairs = down ? [outer, inner] : [inner, outer];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  return pairs.filter((p) => p[0] !== p[1] && p[0] >= 0 && p[1] < n && handOf(p[0], n) !== handOf(p[1], n));
}

/** Lanes whose centre falls in the band's third of the playfield (thirds overlap so none is empty). */
function bandLanes(n: number, band: 0 | 1 | 2): number[] {
  const out: number[] = [];
  for (let l = 0; l < n; l++) {
    const c = (l + 0.5) / n;
    if ((band === 0 && c < 0.4) || (band === 1 && c > 0.25 && c < 0.75) || (band === 2 && c > 0.6)) out.push(l);
  }
  return out.length ? out : [band === 0 ? 0 : band === 2 ? n - 1 : Math.floor(n / 2)];
}

/**
 * Screen positions for a run of circles on `n` lanes: an 8-point cycle across the whole field
 * (left, right, centre, …) whose consecutive entries never share a lane; combined with the
 * renderer's three heights no two consecutive circles sit at the same spot.
 */
export function circleSpread(n: number): number[] {
  const order = [0, n - 1, Math.floor(n / 2), 1, n - 2, Math.ceil(n / 2) - 1, Math.floor(n / 2) + 1, n - 3].filter((l) => l >= 0 && l < n);
  const out: number[] = [];
  let i = 0;
  while (out.length < CIRCLE_SPREAD) {
    const lane = order[i % order.length];
    i++;
    if (n > 1 && out.length && out[out.length - 1] === lane) continue;
    if (n > 1 && out.length === CIRCLE_SPREAD - 1 && lane === out[0]) continue;
    out.push(lane);
  }
  return out;
}

/**
 * Lanes for the composed events. `releaseSlots` is how long a thumb stays busy after its long note
 * ends (the composer's 0.25 s in slots); consecutive tiles closer than `FAST_SEC` go to the other
 * thumb and never to the same lane, and a hold that arrives while a thumb is busy is played as a tap.
 */
export function assignLanes(events: readonly Event[], slots: readonly Slot[], random: () => number, releaseSlots: number): NoteTuple[] {
  const notes: NoteTuple[] = [];
  const heldUntil = new Array<number>(8).fill(-1);
  /** Consecutive events that used each lane — the "≤ 2 in a row per lane" rule. */
  const laneRun = new Array<number>(8).fill(0);
  let lastLane = -1;
  /** Every lane of the last event (both lanes of a chord). */
  let lastEventLanes: number[] = [];
  let lastSi = -100;
  let lastTime = -100;
  let lastSide = 1;
  let motion: Motion | null = null;
  let motionBar = -1;
  let lastLanes = -1;
  let circleIdx = -1;
  let circleOffset = 0;
  let lastCircleSi = -100;
  /**
   * The thumb holding a hold / roll / slide, and the first slot it is free again — the note's end plus
   * the release, the same slot the composer lets the next long note start on.
   */
  let busy: { hand: 0 | 1; until: number } | null = null;
  /**
   * The figure's lanes, remembered per step within a field: the same "tu-DUN-dun" lands in the same
   * lanes bar after bar, so the hands learn the pattern instead of chasing a new layout every bar —
   * and a step keeps its lane even when the figure around it changes.
   */
  const figureLane = new Map<number, number>();

  for (const composed of events) {
    const slot = slots[composed.si];
    const n = composed.bar.lanes;
    if (n !== lastLanes) {
      heldUntil.fill(-1);
      // A new field is a new layout: the figure learns its lanes afresh (a lane 3 memory means nothing on 3 lanes).
      figureLane.clear();
      lastLanes = n;
    }
    if (busy && busy.until <= composed.si) busy = null;
    // A second long note while a thumb is busy is played as a tap — never dropped.
    const ev: Event =
      busy && composed.hold > 0 && composed.kind !== 'spin'
        ? { ...composed, hold: 0, taps: 0, kind: composed.kind === 'roll' || composed.kind === 'slide' ? null : composed.kind }
        : composed;
    if (ev.kind === 'spin') {
      // The field is empty around a spinner (the composer cleared it): both thumbs are free after it.
      const endIdx = Math.min(slots.length - 1, ev.si + ev.hold);
      notes.push([round3(slot.time), 0, round3(slots[endIdx].time - slot.time), 'spin']);
      heldUntil.fill(-1);
      busy = null;
      lastSi = endIdx;
      lastTime = slots[endIdx].time;
      continue;
    }
    // Only lanes the free thumb can reach: not held, and not on the busy thumb's half.
    const free: number[] = [];
    for (let l = 0; l < n; l++) if (heldUntil[l] < ev.si && (!busy || handOf(l, n) !== busy.hand)) free.push(l);
    if (!free.length) continue;
    if (busy && ev.kind === 'circle') continue; // one thumb is busy: no circles (the composer keeps its windows clear)
    const gap = ev.si - lastSi;
    const gapSec = slot.time - lastTime;

    if (ev.bar.index !== motionBar) {
      motionBar = ev.bar.index;
      const kinds: MotionKind[] = ['up', 'down', 'zigzag', 'trill'];
      motion = new Motion(kinds[Math.floor(random() * kinds.length)], n, random);
    }

    let candidates = free;
    // Two thumbs, not one: a tile closer than FAST_SEC to the last one (or a long note starting within an
    // eighth of it) is played by the OTHER hand — one thumb cannot hop lanes that fast. The middle lane of
    // an odd field belongs to either hand, so it never forces a hop.
    const lastHand = lastLane >= 0 ? handOf(lastLane, n) : -1;
    if (lastHand !== -1 && (gap <= 1 || gapSec < FAST_SEC || (ev.hold > 0 && gap <= 2))) {
      const other = candidates.filter((l) => handOf(l, n) !== lastHand);
      if (other.length) candidates = other;
    }
    // Never the same lane twice inside one judgement span: a late tap on the first would miss the second.
    if (lastEventLanes.length && gapSec < FAST_SEC) {
      const fresh = candidates.filter((l) => !lastEventLanes.includes(l));
      if (fresh.length) candidates = fresh;
    }
    // Not three in a row in one lane — when the hands rules above leave a choice.
    const rested = candidates.filter((l) => laneRun[l] < 2);
    if (rested.length) candidates = rested;

    let lanes: number[];
    if (ev.size >= 2 && !busy) {
      const pair = chordPairs(n, ev.step === 0).find((p) => p.every((l) => candidates.includes(l)));
      lanes = pair ? [...pair] : [candidates[Math.floor(random() * candidates.length)]];
    } else if (ev.kind === 'circle') {
      // Circles cycle across the whole field so a group reads as a path: left, right, centre, …
      const spread = circleSpread(n);
      if (ev.si - lastCircleSi > 24) {
        // New group: start the path on a lane the player has not just been hammering.
        circleIdx = 0;
        circleOffset = Math.max(
          0,
          spread.findIndex((l) => laneRun[l] < 2),
        );
      } else circleIdx++;
      lastCircleSi = ev.si;
      lanes = [spread[(circleOffset + circleIdx) % spread.length]];
    } else {
      let lane: number;
      const memory = figureLane.get(ev.step);
      // A step without a lane yet prefers one no other step of its figure has taken, so the figure spreads over the field.
      const taken = new Set(figureLane.values());
      const untaken = candidates.filter((l) => !taken.has(l));
      if (memory === undefined && untaken.length) candidates = untaken;
      if (memory !== undefined && candidates.includes(memory) && gap > 1) {
        lane = memory;
      } else if (gap <= 1 && motion) {
        lane = motion.next(candidates);
      } else if (gap === 2) {
        const side = 1 - lastSide;
        const onSide = candidates.filter((l) => ((l + 0.5) / n < 0.5 ? 0 : 1) === side);
        const pool = onSide.length ? onSide : candidates;
        const band: 0 | 1 | 2 = slot.low >= slot.mid && slot.low >= slot.high ? 0 : slot.high > slot.mid ? 2 : 1;
        const preferred = pool.filter((l) => bandLanes(n, band).includes(l));
        const from = preferred.length ? preferred : pool;
        lane = from[Math.floor(random() * from.length)];
      } else {
        const band: 0 | 1 | 2 = slot.low >= slot.mid && slot.low >= slot.high ? 0 : slot.high > slot.mid ? 2 : 1;
        const group = bandLanes(n, band);
        let pool = candidates.filter((l) => group.includes(l));
        if (!pool.length) pool = candidates;
        const fresh = pool.filter((l) => l !== lastLane);
        const choose = fresh.length && random() < 0.8 ? fresh : pool;
        lane = choose[Math.floor(random() * choose.length)];
      }
      lanes = [lane];
      if (ev.hold === 0 && !ev.kind) figureLane.set(ev.step, lane);
    }

    const time = round3(slot.time);
    for (const lane of lanes) {
      if (ev.hold > 0) {
        const endIdx = Math.min(slots.length - 1, ev.si + ev.hold);
        const freeAt = endIdx + releaseSlots;
        const dur = round3(slots[endIdx].time - slot.time);
        // The thumb that takes a long note: its own half; the middle lane goes to the thumb that just played.
        const h = handOf(lane, n);
        const hand: 0 | 1 = h === -1 ? (lastSide as 0 | 1) : h;
        busy = { hand, until: freeAt };
        if (ev.kind === 'roll') {
          notes.push([time, lane, dur, 'roll', ev.taps]);
          heldUntil[lane] = freeAt;
        } else if (ev.kind === 'slide') {
          // Slide into the free lane next door (never across a lane), staying on the same thumb's half;
          // both lanes are blocked for the duration.
          const options = [lane + 1, lane - 1].filter((l) => l >= 0 && l < n && heldUntil[l] < ev.si && handOf(l, n) !== 1 - hand);
          if (options.length) {
            const end = options[Math.floor(random() * Math.min(2, options.length))];
            notes.push([time, lane, dur, 'slide', end]);
            heldUntil[lane] = freeAt;
            heldUntil[end] = freeAt;
          } else {
            notes.push([time, lane, dur]);
            heldUntil[lane] = freeAt;
          }
        } else {
          notes.push([time, lane, dur]);
          heldUntil[lane] = freeAt;
        }
      } else if (ev.kind) notes.push([time, lane, 0, ev.kind]);
      else notes.push([time, lane]);
    }
    for (let l = 0; l < 8; l++) laneRun[l] = lanes.includes(l) ? laneRun[l] + 1 : 0;
    const primary = lanes[lanes.length - 1];
    lastLane = primary;
    lastEventLanes = lanes;
    lastSide = (primary + 0.5) / n < 0.5 ? 0 : 1;
    lastSi = ev.si;
    lastTime = slot.time;
  }

  notes.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return notes;
}
