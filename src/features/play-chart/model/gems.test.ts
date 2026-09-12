import { describe, expect, it } from 'vitest';
import type { ParsedNote } from '@/entities/chart';
import { BIG_GEM_VALUE, GEM_MAX_COUNT, GEM_MIN_COUNT, GEM_MIN_TIME, gemTotal, isGemCandidate, pickGems } from './gems';

const tap = (time: number, over: Partial<ParsedNote> = {}): ParsedNote => ({ time, lane: 0, duration: 0, kind: null, seq: 0, extra: 0, lanes: 4, ...over });

/** A 120 s song with a tap every 0.5 s plus some holds / spells / circles sprinkled in. */
function song(length = 120, step = 0.5): ParsedNote[] {
  const out: ParsedNote[] = [];
  for (let t = 0; t < length; t += step) {
    const i = Math.round(t / step);
    if (i % 17 === 3) out.push(tap(t, { duration: 1 }));
    else if (i % 23 === 5) out.push(tap(t, { kind: 'slow' }));
    else if (i % 29 === 7) out.push(tap(t, { kind: 'circle', seq: 1 }));
    else if (i % 31 === 9) out.push(tap(t, { kind: 'roll', duration: 1, extra: 4 }));
    else out.push(tap(t, { lane: i % 4 }));
  }
  return out;
}

describe('pickGems', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const notes = song();
    const a = pickGems(notes, 1);
    const b = pickGems(notes, 1);
    const c = pickGems(notes, 2);
    expect(a).toEqual(b);
    expect(a.map((p) => p.index)).not.toEqual(c.map((p) => p.index));
  });

  it('only flags plain taps after the first seconds, 6–10 of them, exactly one big', () => {
    const notes = song();
    const picks = pickGems(notes, 1234);
    expect(picks.length).toBeGreaterThanOrEqual(GEM_MIN_COUNT);
    expect(picks.length).toBeLessThanOrEqual(GEM_MAX_COUNT);
    for (const p of picks) {
      const n = notes[p.index];
      expect(isGemCandidate(n)).toBe(true);
      expect(n.kind).toBeNull();
      expect(n.duration).toBe(0);
      expect(n.time).toBeGreaterThanOrEqual(GEM_MIN_TIME);
    }
    expect(picks.filter((p) => p.value === BIG_GEM_VALUE)).toHaveLength(1);
    expect(picks.filter((p) => p.value === 1)).toHaveLength(picks.length - 1);
    expect(gemTotal(picks)).toBe(picks.length - 1 + BIG_GEM_VALUE);
    // No duplicates, sorted by time.
    const idx = picks.map((p) => p.index);
    expect(new Set(idx).size).toBe(idx.length);
    expect([...idx].sort((x, y) => x - y)).toEqual(idx);
  });

  it('spreads gems over the song: one per time slot, never two in a row', () => {
    const notes = song(150);
    for (const seed of [1, 7, 99, 2024]) {
      const picks = pickGems(notes, seed);
      const times = picks.map((p) => notes[p.index].time);
      const span = 150 - GEM_MIN_TIME;
      const slot = span / picks.length;
      for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThan(slot * 0.25);
      // First and last thirds of the song both get gems.
      expect(times[0]).toBeLessThan(GEM_MIN_TIME + span / 3);
      expect(times[times.length - 1]).toBeGreaterThan(150 - span / 3);
    }
  });

  it('scales the count with song length', () => {
    expect(pickGems(song(60), 5).length).toBe(GEM_MIN_COUNT);
    expect(pickGems(song(300), 5).length).toBe(GEM_MAX_COUNT);
    expect(pickGems(song(135), 5).length).toBeGreaterThan(GEM_MIN_COUNT);
  });

  it('degrades gracefully: few candidates → all of them, none → empty', () => {
    const few = [tap(1), tap(6), tap(8, { kind: 'heart' }), tap(9), tap(12, { duration: 2 }), tap(20)];
    const picks = pickGems(few, 3);
    expect(picks.map((p) => p.index)).toEqual([1, 3, 5]);
    expect(picks.filter((p) => p.value === BIG_GEM_VALUE)).toHaveLength(1);
    expect(pickGems([tap(1), tap(2), tap(30, { duration: 1 })], 3)).toEqual([]);
    expect(pickGems([], 3)).toEqual([]);
  });
});
