import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DENSITY_LIMIT, KEY_LABELS, MAX_LANES, MIN_LANES } from '@/shared/config/constants';
import type { ChartFile } from '@/shared/types/chart';
import { parseChartLevel, parseSections, type ParsedNote } from '@/entities/chart';
import { REPLAY_STEPS, SPELL_LANE, TUTORIAL_PLAN, beatIndex, beatTime, buildScript, captionAt, type TutorialStepId } from './script';

const ROOT = new URL('../../../../', import.meta.url);
const file = JSON.parse(readFileSync(new URL('public/charts/tutorial.json', ROOT), 'utf8')) as ChartFile;
const beats = file.beats ?? [];
const notes = parseChartLevel(file.chart);
const sections = parseSections(file.chart);
const script = buildScript(beats);
/** Notes fall this many beats (GameSession APPROACH_BEATS). */
const FALL_BEATS = 3.5;

/** Distance from `t` to the nearest 16th-note grid point of the tracked beats. */
function gridError(t: number): number {
  let best = Infinity;
  for (let i = 0; i < beats.length - 1; i++) {
    const step = (beats[i + 1] - beats[i]) / 4;
    for (let k = 0; k < 4; k++) best = Math.min(best, Math.abs(t - (beats[i] + k * step)));
  }
  return best;
}

/** tap / hold / heart (and anything else that must not be there). */
const kindOf = (n: ParsedNote): string => (n.kind === null ? (n.duration > 0 ? 'hold' : 'tap') : n.kind);
const stepOf = (n: ParsedNote) => script[captionAt(script, n.time)];
const notesIn = (id: TutorialStepId) => notes.filter((n) => stepOf(n)?.id === id);
const lastEnd = Math.max(...notes.map((n) => n.time + n.duration));

describe('public/charts/tutorial.json', () => {
  it('is a valid ChartFile on the tutorial song (a CC0 track kept for the tutorial only), cut to its 75 s mp3', () => {
    expect(file.id).toBe('tutorial');
    expect(file.title).toBe('Обучение');
    expect(file.chart.stars).toBe(1);
    const src = JSON.parse(readFileSync(new URL('assets-src/tutorial.json', ROOT), 'utf8')) as ChartFile;
    expect(file.audio).toBe(src.audio);
    expect(file.bpm).toBe(src.bpm);
    expect(file.offset).toBe(src.offset);
    expect(file.license).toBe(src.license);
    expect(file.sourceUrl).toBe(src.sourceUrl);
    expect(file.artist).toBe(src.artist);
    // The song file is the first 75 s of the source (1.5 s fade-out); the grid is cut with it.
    expect(file.duration).toBe(75);
    expect(file.beats).toEqual((src.beats ?? []).filter((t) => t <= 75));
    expect(beats.length).toBeGreaterThan(100);
  });

  it('keeps the first launch light: the song is well under the old 4.6 MB', () => {
    const bytes = statSync(new URL('public/music/tutorial.mp3', ROOT)).size;
    expect(bytes).toBeGreaterThan(1_000_000); // 75 s of real music, not a stub
    expect(bytes).toBeLessThan(2_600_000);
  });

  it('lasts about 40 s and is over before the song fades out', () => {
    expect(notes.length).toBeGreaterThanOrEqual(30);
    expect(lastEnd).toBeGreaterThan(30);
    expect(lastEnd).toBeLessThan(45);
    // The run ends 1.5 s after the last note — long before the fade-out at 73.5 s.
    expect(lastEnd + 1.5).toBeLessThan((file.duration ?? 0) - 1.5);
  });

  it('puts every note (and every tail) within 30 ms of a 16th subdivision of the beats', () => {
    for (const n of notes) {
      expect(gridError(n.time), `note at ${n.time}`).toBeLessThanOrEqual(0.03);
      if (n.duration > 0) expect(gridError(n.time + n.duration), `tail of ${n.time}`).toBeLessThanOrEqual(0.03);
    }
  });

  it('walks the lane counts 1 → 2 → 3 → 4, each change after ≥ 2 beats of silence', () => {
    expect(sections.map((s) => s.lanes)).toEqual([1, 2, 3, 4]);
    // The one-lane section starts at song time 0, so the parser does not prepend a default one.
    expect(sections[0].time).toBe(0);
    for (const s of sections) {
      expect(s.lanes).toBeGreaterThanOrEqual(MIN_LANES);
      expect(s.lanes).toBeLessThanOrEqual(Math.min(4, MAX_LANES));
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
      const used = new Set(notes.filter((n) => n.lanes === sec.lanes).map((n) => n.lane));
      expect(used.size, `${sec.lanes} lanes`).toBe(sec.lanes);
    }
  });

  it('has only what chapter 1 has: taps, holds and one heart — no chords, never two things at once', () => {
    expect(new Set(notes.map(kindOf))).toEqual(new Set(['tap', 'hold', 'heart']));
    const times = notes.map((n) => n.time);
    expect(new Set(times).size).toBe(times.length);
    for (const n of notes) {
      const active = notes.filter((m) => m !== n && m.time <= n.time && m.time + m.duration > n.time);
      expect(active, `something still going at ${n.time}`).toHaveLength(0);
    }
    const sorted = [...new Set(times)].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      let count = 0;
      for (let j = i; j < sorted.length && sorted[j] - sorted[i] <= 1; j++) count++;
      expect(count, `window from ${sorted[i]}`).toBeLessThanOrEqual(DENSITY_LIMIT);
    }
  });

  it('has exactly one spell — a heart on the 4-lane section, in the heart lane', () => {
    const spells = notes.filter((n) => n.kind === 'slow' || n.kind === 'heart');
    expect(spells).toHaveLength(1);
    expect(spells[0].kind).toBe('heart');
    expect(spells[0].lanes).toBe(4);
    // The caption's `{key}` is derived from SPELL_LANE — the chart must agree.
    expect(spells[0].lane).toBe(SPELL_LANE);
  });

  it('teaches the mechanics in the scripted order: every note falls inside a step that allows its kind', () => {
    const allowed: Record<TutorialStepId, readonly string[]> = {
      intro: [],
      tap: ['tap'],
      hold: ['hold'],
      lanes2: ['tap'],
      alt: ['tap'],
      lanes3: ['tap', 'hold'],
      lanes4: ['tap', 'hold'],
      spell: ['heart', 'tap', 'hold'],
      finale: [],
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
      // A note never spills into the next step: the caption changes once it is over.
      expect(n.time + n.duration, `tail of ${n.time} in ${step.id}`).toBeLessThanOrEqual(step.to + 1e-6);
    }
    // Every step but the intro and the finale has notes.
    for (const p of TUTORIAL_PLAN) expect(seen.has(p.id), p.id).toBe(allowed[p.id].length > 0);
    // Each `lanes` step sits over its lane change: the change happens inside it…
    for (const p of TUTORIAL_PLAN.filter((p) => p.kind === 'lanes')) {
      const step = script.find((s) => s.id === p.id)!;
      const sec = sections.find((s) => s.lanes === p.lanes)!;
      expect(sec.time, p.id).toBeGreaterThanOrEqual(step.from);
      expect(sec.time, p.id).toBeLessThan(step.to);
      // …and the previous step's last note is already gone when the caption changes.
      const prevEnd = Math.max(...notes.filter((n) => n.time < step.from).map((n) => n.time + n.duration));
      expect(prevEnd).toBeLessThanOrEqual(step.from + 1e-6);
    }
    // The finale starts as the last note ends: the frame comes with the end of the run.
    const finale = script.find((s) => s.id === 'finale')!;
    expect(finale.from).toBeCloseTo(lastEnd, 3);
    // Step counts as designed.
    const taps = notesIn('tap');
    expect(taps).toHaveLength(8);
    expect(taps.every((n) => n.lane === 0 && n.lanes === 1)).toBe(true);
    expect(notesIn('hold')).toHaveLength(3);
    expect(notesIn('hold').every((n) => n.duration > 0 && n.lanes === 1)).toBe(true);
    // Enough one-lane notes to learn the player's latency from (review: ≥ 8 presses).
    expect(notes.filter((n) => n.lanes === 1).length).toBeGreaterThanOrEqual(8);
    expect(new Set(notesIn('lanes2').map((n) => n.lane))).toEqual(new Set([0, 1]));
    const alt = notesIn('alt');
    expect(alt.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < alt.length; i++) expect(alt[i].lane).not.toBe(alt[i - 1].lane);
    expect(new Set(notesIn('lanes3').map((n) => n.lane)).size).toBe(3);
    expect(new Set(notesIn('lanes4').map((n) => n.lane)).size).toBe(4);
    expect(notesIn('spell')[0].kind).toBe('heart');
  });

  it('lets the replayed steps show their notes from the top: the first lands a whole fall after the rewind point', () => {
    for (const id of REPLAY_STEPS) {
      const step = script.find((s) => s.id === id)!;
      const own = notesIn(id);
      expect(own.length, id).toBeGreaterThan(0);
      expect(beatIndex(beats, own[0].time) - beatIndex(beats, step.from), id).toBeGreaterThanOrEqual(FALL_BEATS);
      // The last head is judged (Good window 0.15 s) and reported (~0.1 s) before the step is over.
      const lastHead = Math.max(...own.map((n) => n.time));
      expect(step.to - lastHead, id).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('captions carry the lane count, its key caps and a lane title on every lane change', () => {
    const titles: Record<number, string> = { 2: 'Две полосы', 3: 'Три полосы', 4: 'Четыре полосы' };
    for (const s of script) {
      expect(s.keys).toEqual(KEY_LABELS[s.lanes]);
      expect(s.keys).toHaveLength(s.lanes);
      if (s.kind === 'lanes') {
        expect(s.title).toBe(titles[s.lanes]);
        expect(s.hintDesktop).toContain(s.keys.join(' '));
        expect(s.hintTouch.length).toBeGreaterThan(0);
      }
    }
    expect(script.map((s) => s.lanes)).toEqual([1, 1, 1, 2, 2, 3, 4, 4, 4]);
    // ~45 s with the 2 s count-in and the 1.5 s after the last note.
    expect(2 + lastEnd + 1.5).toBeGreaterThan(35);
    expect(2 + lastEnd + 1.5).toBeLessThan(50);
    expect(beatTime(beats, 0)).toBeCloseTo(beats[0], 6);
  });
});
