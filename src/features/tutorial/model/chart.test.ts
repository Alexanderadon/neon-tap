import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DENSITY_LIMIT } from '@/shared/config/constants';
import type { ChartFile } from '@/shared/types/chart';
import { parseChartLevel, parseSections, type ParsedNote } from '@/entities/chart';
import { TUTORIAL_PLAN, beatTime, buildScript, captionAt } from './script';

const ROOT = new URL('../../../../', import.meta.url);
const file = JSON.parse(readFileSync(new URL('public/charts/tutorial.json', ROOT), 'utf8')) as ChartFile;
const beats = file.beats ?? [];
const notes = parseChartLevel(file.chart);
const sections = parseSections(file.chart);
const script = buildScript(beats);

/** Distance from `t` to the nearest 16th-note grid point of the tracked beats. */
function gridError(t: number): number {
  let best = Infinity;
  for (let i = 0; i < beats.length - 1; i++) {
    const step = (beats[i + 1] - beats[i]) / 4;
    for (let k = 0; k < 4; k++) best = Math.min(best, Math.abs(t - (beats[i] + k * step)));
  }
  return best;
}

const beatLen = (t: number): number => {
  const i = Math.max(0, Math.min(beats.length - 2, beats.findIndex((b) => b > t) - 1));
  return beats[i + 1] - beats[i];
};

describe('public/charts/tutorial.json', () => {
  it('is a valid ChartFile that reuses a CC0 catalog track', () => {
    expect(file.id).toBe('tutorial');
    expect(file.title).toBe('Обучение');
    expect(file.chart.stars).toBe(1);
    expect(beats.length).toBeGreaterThan(100);
    const src = JSON.parse(readFileSync(new URL('public/charts/apparatus-overlord.json', ROOT), 'utf8')) as ChartFile;
    expect(file.audio).toBe(src.audio);
    expect(file.bpm).toBe(src.bpm);
    expect(file.offset).toBe(src.offset);
    expect(file.beats).toEqual(src.beats);
    expect(file.license).toBe(src.license);
    expect(file.sourceUrl).toBe(src.sourceUrl);
    expect(file.artist).toBe(src.artist);
    expect(notes.length).toBeGreaterThan(30);
    const last = Math.max(...notes.map((n) => n.time + n.duration));
    expect(last).toBeGreaterThan(55);
    expect(last).toBeLessThan(80);
  });

  it('puts every note (and every tail) within 30 ms of a 16th subdivision of the beats', () => {
    for (const n of notes) {
      expect(gridError(n.time), `note at ${n.time}`).toBeLessThanOrEqual(0.03);
      if (n.duration > 0) expect(gridError(n.time + n.duration), `tail of ${n.time}`).toBeLessThanOrEqual(0.03);
    }
  });

  it('keeps rolls at 3+ taps and ≤ 6 taps per second', () => {
    const rolls = notes.filter((n) => n.kind === 'roll');
    expect(rolls).toHaveLength(3);
    for (const r of rolls) {
      expect(r.extra).toBeGreaterThanOrEqual(3);
      expect(r.extra / r.duration).toBeLessThanOrEqual(6);
    }
  });

  it('slides only to the adjacent lane with nothing else on screen meanwhile', () => {
    const slides = notes.filter((n) => n.kind === 'slide');
    expect(slides).toHaveLength(3);
    for (const s of slides) {
      expect(Math.abs(s.extra - s.lane)).toBe(1);
      const others = notes.filter((n) => n !== s && n.time < s.time + s.duration && n.time + n.duration > s.time);
      expect(others, `notes during slide at ${s.time}`).toHaveLength(0);
    }
  });

  it('stays under the density cap and the two-thumb rule', () => {
    const times = [...new Set(notes.map((n) => n.time))].sort((a, b) => a - b);
    for (let i = 0; i < times.length; i++) {
      let count = 0;
      for (let j = i; j < times.length && times[j] - times[i] <= 1; j++) count++;
      expect(count, `window from ${times[i]}`).toBeLessThanOrEqual(DENSITY_LIMIT);
    }
    // Never more than two things at once: active long notes + simultaneous taps.
    for (const n of notes) {
      const active = notes.filter((m) => m.time <= n.time && m.time + Math.max(m.duration, 0.001) > n.time);
      expect(active.length, `at ${n.time}`).toBeLessThanOrEqual(2);
      const longs = active.filter((m) => m.duration > 0);
      expect(longs.length, `long notes at ${n.time}`).toBeLessThanOrEqual(1);
    }
  });

  it('has a circle window with 3 numbered circles and no lane notes around it', () => {
    const circles = notes.filter((n) => n.kind === 'circle');
    expect(circles.map((c) => c.seq)).toEqual([1, 2, 3]);
    const from = circles[0].time - beatLen(circles[0].time);
    const to = circles[2].time + beatLen(circles[2].time);
    const inside = notes.filter((n) => n.kind !== 'circle' && n.time + n.duration >= from && n.time <= to);
    expect(inside).toHaveLength(0);
    // Zig-zag across the field: consecutive circles never share a lane.
    for (let i = 1; i < circles.length; i++) expect(circles[i].lane).not.toBe(circles[i - 1].lane);
  });

  it('changes lanes 4 → 3 once, with at least 2 beats of silence before the change', () => {
    expect(sections.map((s) => s.lanes)).toEqual([4, 3]);
    const change = sections[1].time;
    for (const s of sections) expect(s.lanes).toBeGreaterThanOrEqual(3);
    for (const s of sections) expect(s.lanes).toBeLessThanOrEqual(5);
    const before = Math.max(...notes.filter((n) => n.time < change).map((n) => n.time + n.duration));
    expect(change - before).toBeGreaterThanOrEqual(2 * beatLen(change) - 0.01);
    for (const n of notes) expect(n.lane, `lane at ${n.time}`).toBeLessThan(n.time >= change ? 3 : 4);
  });

  it('teaches the mechanics in the scripted order: every note falls inside a step of its kind', () => {
    const kindOf = (n: ParsedNote): string => (n.kind === null ? (n.duration > 0 ? 'hold' : 'tap') : n.kind);
    const seen = new Set<string>();
    for (const n of notes) {
      const i = captionAt(script, n.time);
      expect(i, `no caption at ${n.time}`).toBeGreaterThanOrEqual(0);
      const step = script[i];
      seen.add(step.id);
      if (step.kind === 'free') continue;
      if (step.kind === 'lanes') {
        expect(kindOf(n)).toBe('tap');
        continue;
      }
      expect(kindOf(n), `note at ${n.time} in step ${step.id}`).toBe(step.kind);
      // The step's caption is up 2+ beats before its first note lands.
      expect(n.time - step.from).toBeGreaterThanOrEqual(2 * beatLen(n.time) - 0.01);
    }
    expect(TUTORIAL_PLAN.filter((p) => p.id !== 'intro').every((p) => seen.has(p.id))).toBe(true);
    const intro = script[0];
    expect(notes.some((n) => n.time < intro.to)).toBe(false);
    // Step counts as designed: 4 taps in one lane, then alternating lanes.
    const tapStep = script.find((s) => s.id === 'tap')!;
    const first = notes.filter((n) => n.time >= tapStep.from && n.time < tapStep.to);
    expect(first).toHaveLength(4);
    expect(new Set(first.map((n) => n.lane)).size).toBe(1);
    for (const n of first) expect(gridError(n.time)).toBeLessThanOrEqual(0.03);
    expect(beatTime(beats, 10)).toBeCloseTo(first[0].time, 3);
    const alt = script.find((s) => s.id === 'alt')!;
    const second = notes.filter((n) => n.time >= alt.from && n.time < alt.to);
    for (let i = 1; i < second.length; i++) expect(second[i].lane).not.toBe(second[i - 1].lane);
    const lanes = script.find((s) => s.id === 'lanes')!;
    expect(sections[1].time).toBeGreaterThan(lanes.from);
    expect(sections[1].time).toBeLessThan(lanes.to);
  });
});
