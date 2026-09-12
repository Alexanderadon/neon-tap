import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DENSITY_LIMIT, KEY_LABELS, MAX_LANES, MIN_LANES } from '@/shared/config/constants';
import type { ChartFile } from '@/shared/types/chart';
import { parseChartLevel, parseSections, type ParsedNote } from '@/entities/chart';
import { SPELL_LANE, TUTORIAL_PLAN, beatIndex, beatTime, buildScript, captionAt, type TutorialStepId } from './script';

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

/** tap / hold / slide / roll / circle / slow / heart. */
const kindOf = (n: ParsedNote): string => (n.kind === null ? (n.duration > 0 ? 'hold' : 'tap') : n.kind);
const stepOf = (n: ParsedNote) => script[captionAt(script, n.time)];
const notesIn = (id: TutorialStepId) => notes.filter((n) => stepOf(n)?.id === id);

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
    expect(notes.length).toBeGreaterThan(40);
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

  it('walks the lane counts 1 → 2 → 3 → 4 → 5 → 6, each change after ≥ 2 beats of silence', () => {
    expect(sections.map((s) => s.lanes)).toEqual([1, 2, 3, 4, 5, 6]);
    // The one-lane section starts at song time 0, so the parser does not prepend a default one.
    expect(sections[0].time).toBe(0);
    for (const s of sections) {
      expect(s.lanes).toBeGreaterThanOrEqual(MIN_LANES);
      expect(s.lanes).toBeLessThanOrEqual(MAX_LANES);
    }
    for (let i = 1; i < sections.length; i++) {
      const change = sections[i].time;
      expect(gridError(change), `section at ${change}`).toBeLessThanOrEqual(0.03);
      const before = Math.max(...notes.filter((n) => n.time < change).map((n) => n.time + n.duration));
      expect(beatIndex(beats, change) - beatIndex(beats, before), `gap before ${sections[i].lanes} lanes`).toBeGreaterThanOrEqual(2 - 0.05);
      // The first note of the new section lands ≥ 2 beats after the change.
      const first = Math.min(...notes.filter((n) => n.time >= change).map((n) => n.time));
      expect(beatIndex(beats, first) - beatIndex(beats, change)).toBeGreaterThanOrEqual(2 - 0.05);
    }
    // Every note fits its section, and every lane of every section is used at least once.
    for (const n of notes) {
      const sec = [...sections].reverse().find((s) => s.time <= n.time)!;
      expect(n.lanes, `lanes at ${n.time}`).toBe(sec.lanes);
      expect(n.lane).toBeLessThan(sec.lanes);
    }
    for (const sec of sections) {
      const used = new Set(notes.filter((n) => n.lanes === sec.lanes).flatMap((n) => (n.kind === 'slide' ? [n.lane, n.extra] : [n.lane])));
      expect(used.size, `${sec.lanes} lanes`).toBe(sec.lanes);
    }
  });

  it('keeps rolls at 3+ taps and ≤ 6 taps per second', () => {
    const rolls = notes.filter((n) => n.kind === 'roll');
    expect(rolls.length).toBeGreaterThanOrEqual(3);
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

  it('has one circle window: 4 numbered circles ≥ an 8th apart, zig-zagging, no lane notes around it', () => {
    const circles = notes.filter((n) => n.kind === 'circle');
    expect(circles.map((c) => c.seq)).toEqual([1, 2, 3, 4]);
    for (let i = 1; i < circles.length; i++) {
      expect(circles[i].time - circles[i - 1].time).toBeGreaterThanOrEqual(beatLen(circles[i].time) / 2 - 0.01);
      expect(circles[i].lane).not.toBe(circles[i - 1].lane);
    }
    const from = circles[0].time - beatLen(circles[0].time);
    const to = circles[circles.length - 1].time + beatLen(circles[circles.length - 1].time);
    const inside = notes.filter((n) => n.kind !== 'circle' && n.time + n.duration >= from && n.time <= to);
    expect(inside).toHaveLength(0);
    expect(circles.every((c) => c.lanes === 4)).toBe(true);
  });

  it('has exactly one spell (slow-motion) on the 4-lane section, and no heart (there are no hearts)', () => {
    const spells = notes.filter((n) => n.kind === 'slow' || n.kind === 'heart');
    expect(spells).toHaveLength(1);
    expect(spells[0].kind).toBe('slow');
    expect(spells[0].lanes).toBe(4);
    // The caption's `{key}` is derived from SPELL_LANE — the chart must agree.
    expect(spells[0].lane).toBe(SPELL_LANE);
    // The slow-motion (6 song-seconds) is over before the next section's first note.
    const next = sections.find((s) => s.time > spells[0].time)!;
    const first = Math.min(...notes.filter((n) => n.time >= next.time).map((n) => n.time));
    expect(first - spells[0].time).toBeGreaterThanOrEqual(6);
  });

  it('teaches the mechanics in the scripted order: every note falls inside a step that allows its kind', () => {
    const allowed: Record<TutorialStepId, readonly string[]> = {
      intro: [],
      tap: ['tap'],
      hold: ['hold'],
      lanes2: [],
      alt: ['tap'],
      slide: ['slide'],
      lanes3: [],
      roll: ['roll'],
      lanes4: [],
      circle: ['circle'],
      spell: ['slow', 'tap'],
      lanes5: [],
      mixed: ['tap', 'hold', 'roll', 'slide'],
      lanes6: [],
      spin: ['spin'],
      finale: ['tap', 'hold'],
    };
    const seen = new Set<string>();
    for (const n of notes) {
      const i = captionAt(script, n.time);
      expect(i, `no caption at ${n.time}`).toBeGreaterThanOrEqual(0);
      const step = script[i];
      seen.add(step.id);
      expect(allowed[step.id], `${kindOf(n)} at ${n.time} in step ${step.id}`).toContain(kindOf(n));
      expect(step.lanes, `step ${step.id} lanes at ${n.time}`).toBe(n.lanes);
      // The step's caption is up 2+ beats before its first note lands.
      expect(beatIndex(beats, n.time) - beatIndex(beats, step.from), `lead of ${step.id}`).toBeGreaterThanOrEqual(2 - 0.05);
    }
    // Every mechanic step has notes; lane-change steps and the intro are note-free.
    for (const p of TUTORIAL_PLAN) expect(seen.has(p.id), p.id).toBe(allowed[p.id].length > 0);
    // Each `lanes` step sits over its lane change: the change happens inside it.
    for (const p of TUTORIAL_PLAN.filter((p) => p.kind === 'lanes')) {
      const step = script.find((s) => s.id === p.id)!;
      const sec = sections.find((s) => s.lanes === p.lanes)!;
      expect(sec.time, p.id).toBeGreaterThanOrEqual(step.from);
      expect(sec.time, p.id).toBeLessThan(step.to);
      // …and the previous step's last note is already gone when the caption changes.
      const prevEnd = Math.max(...notes.filter((n) => n.time < step.from).map((n) => n.time + n.duration));
      expect(prevEnd).toBeLessThanOrEqual(step.from + 1e-6);
    }
    // Step counts as designed.
    const first = notesIn('tap');
    expect(first).toHaveLength(8);
    expect(first.every((n) => n.lane === 0 && n.lanes === 1)).toBe(true);
    for (const n of first) expect(gridError(n.time)).toBeLessThanOrEqual(0.03);
    expect(beatTime(beats, 10)).toBeCloseTo(first[0].time, 3);
    expect(notesIn('hold')).toHaveLength(3);
    const alt = notesIn('alt');
    expect(alt.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < alt.length; i++) expect(alt[i].lane).not.toBe(alt[i - 1].lane);
    expect(notesIn('slide').map((n) => [n.lane, n.extra])).toEqual([
      [0, 1],
      [1, 0],
    ]);
    expect(notesIn('roll')).toHaveLength(3);
    expect(notesIn('circle')).toHaveLength(4);
    // One spinner, alone on the field: a beat of nothing before it and the notes' whole fall (3.5 beats) after it.
    const spin = notesIn('spin');
    expect(spin).toHaveLength(1);
    expect(spin[0].duration).toBeGreaterThanOrEqual(1.5);
    for (const n of notes) {
      if (n === spin[0]) continue;
      const end = n.time + n.duration;
      const beatsAfter = beatIndex(beats, n.time) - beatIndex(beats, spin[0].time + spin[0].duration);
      expect(end <= spin[0].time - 0.4 || beatsAfter >= 3.5 - 0.05, `note at ${n.time} too close to the spinner`).toBe(true);
    }
    expect(notesIn('mixed').map(kindOf)).toEqual(expect.arrayContaining(['tap', 'hold', 'roll', 'slide']));
    // The mixed step ends on a chord (two taps at once), the finale contains a chord too.
    const chord = (id: TutorialStepId) => {
      const t = notesIn(id).map((n) => n.time);
      return t.some((x, i) => t.indexOf(x) !== i);
    };
    expect(chord('mixed')).toBe(true);
    expect(chord('finale')).toBe(true);
    expect(notesIn('finale').length).toBeGreaterThanOrEqual(8);
  });

  it('captions carry the lane count, its key caps and a "Полосы: N" title on every lane change', () => {
    for (const s of script) {
      expect(s.keys).toEqual(KEY_LABELS[s.lanes]);
      expect(s.keys).toHaveLength(s.lanes);
      if (s.kind === 'lanes') {
        expect(s.title).toBe(`Полосы: ${s.lanes}`);
        expect(s.hintDesktop).toContain(s.keys.join(' '));
        expect(s.hintTouch.length).toBeGreaterThan(0);
      }
      expect(s.hintDesktop).not.toMatch(/\{\w+\}/);
      expect(s.hintTouch).not.toMatch(/\{\w+\}/);
    }
    expect(script.map((s) => s.lanes)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 6]);
  });
});
