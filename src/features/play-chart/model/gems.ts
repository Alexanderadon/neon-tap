import { clamp, mulberry32 } from '@/shared/lib/math';
import type { ParsedNote } from '@/entities/chart';

/** A note chosen to carry a crystal: index into the sorted note list + payout. */
export interface GemPick {
  index: number;
  /** 1 for a regular gem, `BIG_GEM_VALUE` for the rare big one. */
  value: number;
}

/** Gems never sit in the first seconds of a level — the player is still settling in (counted from where the level starts: a skipped intro moves it). */
export const GEM_MIN_TIME = 5;
/** Target number of gems per level, scaled by song length (one per ~30 s), clamped to this range. */
export const GEM_MIN_COUNT = 3;
export const GEM_MAX_COUNT = 5;
export const GEM_SECONDS_PER_GEM = 30;
export const BIG_GEM_VALUE = 3;
/** An endless loop past the third level carries only this many small gems (no big one). */
export const LOOP_GEM_COUNT = 3;

/** A gem can only ride a plain tap: no hold, no spell, no circle, no roll, no slide — and not in the level's first GEM_MIN_TIME seconds (`startAt`: where it starts). */
export function isGemCandidate(n: ParsedNote, startAt = 0): boolean {
  return n.kind === null && n.duration === 0 && n.time >= startAt + GEM_MIN_TIME;
}

/** Sum of a pick list. */
export function gemTotal(picks: readonly GemPick[]): number {
  let sum = 0;
  for (const p of picks) sum += p.value;
  return sum;
}

function gemCandidates(notes: readonly ParsedNote[], startAt: number): number[] {
  const candidates: number[] = [];
  for (let i = 0; i < notes.length; i++) if (isGemCandidate(notes[i], startAt)) candidates.push(i);
  return candidates;
}

/**
 * Choose which notes carry crystals in a level. Deterministic for a given `seed` (mulberry32).
 *
 * The eligible span (first candidate → last candidate) is cut into `count` equal time slots and
 * one random candidate is taken from each, so gems are spread over the whole song instead of
 * clustering; slots without candidates are skipped. Exactly one of the picks (random) is the big
 * gem worth `BIG_GEM_VALUE`. Fewer than `count` candidates → every candidate becomes a gem.
 * `startAt`: where the level starts (song seconds; past a skipped intro).
 */
export function pickGems(notes: readonly ParsedNote[], seed: number, duration?: number, startAt = 0): GemPick[] {
  const candidates = gemCandidates(notes, startAt);
  if (candidates.length === 0) return [];
  const rnd = mulberry32(seed);
  const first = notes[candidates[0]].time;
  const last = notes[candidates[candidates.length - 1]].time;
  const span = Math.max(last, duration ?? last) - first;
  const count = Math.min(candidates.length, clamp(Math.round(span / GEM_SECONDS_PER_GEM), GEM_MIN_COUNT, GEM_MAX_COUNT));
  const picks = spreadGems(notes, candidates, count, rnd);
  if (picks.length > 0) picks[Math.floor(rnd() * picks.length)].value = BIG_GEM_VALUE;
  return picks;
}

/** An endless loop's gems: `LOOP_GEM_COUNT` small ones spread over the song, no big one. Deterministic per `seed`. */
export function pickLoopGems(notes: readonly ParsedNote[], seed: number, startAt = 0): GemPick[] {
  const candidates = gemCandidates(notes, startAt);
  if (candidates.length === 0) return [];
  return spreadGems(notes, candidates, Math.min(candidates.length, LOOP_GEM_COUNT), mulberry32(seed));
}

/** `count` small gems, one per equal time slot of the candidates' span (see `pickGems`). */
function spreadGems(notes: readonly ParsedNote[], candidates: readonly number[], count: number, rnd: () => number): GemPick[] {
  const first = notes[candidates[0]].time;
  const last = notes[candidates[candidates.length - 1]].time;
  const picks: GemPick[] = [];
  if (count >= candidates.length) {
    for (const index of candidates) picks.push({ index, value: 1 });
  } else {
    const slot = (last - first) / count || 1;
    let cursor = 0;
    for (let k = 0; k < count; k++) {
      // Slot k covers [first + k·slot, first + (k+1)·slot); the last one runs to the end.
      const from = first + k * slot;
      const to = k === count - 1 ? Infinity : from + slot;
      const start = cursor;
      while (cursor < candidates.length && notes[candidates[cursor]].time < to) cursor++;
      if (cursor <= start) continue;
      // Prefer the middle 60 % of the slot so neighbouring picks are at least 0.4 slot apart.
      let lo = start;
      let hi = cursor;
      while (lo < hi && notes[candidates[lo]].time < from + slot * 0.2) lo++;
      while (hi > lo && notes[candidates[hi - 1]].time > from + slot * 0.8) hi--;
      if (hi <= lo) {
        lo = start;
        hi = cursor;
      }
      picks.push({ index: candidates[lo + Math.floor(rnd() * (hi - lo))], value: 1 });
    }
    // Empty slots (silence, a circle window, a long hold) leave holes — top up from the rest so the
    // count still lands in range, keeping the order by time.
    if (picks.length < count) {
      const taken = new Set(picks.map((p) => p.index));
      const rest = candidates.filter((i) => !taken.has(i));
      while (picks.length < count && rest.length > 0) {
        const j = Math.floor(rnd() * rest.length);
        picks.push({ index: rest[j], value: 1 });
        rest.splice(j, 1);
      }
      picks.sort((a, b) => a.index - b.index);
    }
  }
  return picks;
}
