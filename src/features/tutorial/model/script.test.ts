import { describe, expect, it } from 'vitest';
import { KEY_LABELS } from '@/shared/config/constants';
import { SPELL_LANE, TUTORIAL_PLAN, beatIndex, beatTime, buildScript, captionAt, keyHint, laneKey, stepProgress, zoneHint } from './script';

/** A perfectly even 120 BPM grid starting at 1.0 s. */
const BEATS = Array.from({ length: 200 }, (_, i) => 1 + i * 0.5);

describe('tutorial script', () => {
  it('maps beat indices to song seconds, including fractions and open ends', () => {
    expect(beatTime(BEATS, 0)).toBe(1);
    expect(beatTime(BEATS, 10)).toBe(6);
    expect(beatTime(BEATS, 10.5)).toBeCloseTo(6.25, 6);
    expect(beatTime(BEATS, -Infinity)).toBe(-Infinity);
    expect(beatTime(BEATS, Infinity)).toBe(Infinity);
    // Past the last beat → extrapolate with the last interval.
    expect(beatTime(BEATS, 205)).toBeCloseTo(1 + 205 * 0.5, 6);
  });

  it('inverts beat times back to beat indices on uneven grids too', () => {
    const uneven = [1, 1.52, 2.01, 2.49, 3.02, 3.5];
    for (const b of [0, 0.25, 1, 2.75, 4.5, 5, 7.5, -1]) expect(beatIndex(uneven, beatTime(uneven, b))).toBeCloseTo(b, 9);
    expect(beatIndex(BEATS, 6)).toBe(10);
    expect(beatIndex(BEATS, Infinity)).toBe(Infinity);
    expect(beatIndex([], 3)).toBe(3);
    expect(beatIndex([2], 3)).toBe(2);
  });

  it('builds contiguous, sorted steps with copy, lane counts and key caps for every plan entry', () => {
    const script = buildScript(BEATS);
    expect(script).toHaveLength(TUTORIAL_PLAN.length);
    expect(script[0].from).toBe(-Infinity);
    expect(script[script.length - 1].to).toBe(Infinity);
    for (let i = 1; i < script.length; i++) {
      expect(script[i].from).toBe(script[i - 1].to);
      expect(script[i].from).toBeGreaterThan(script[i - 1].from);
      // The lane count never decreases and only changes on a `lanes` step.
      expect(script[i].lanes).toBeGreaterThanOrEqual(script[i - 1].lanes);
      if (script[i].lanes !== script[i - 1].lanes) expect(script[i].kind).toBe('lanes');
    }
    for (const s of script) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.title.length).toBeLessThanOrEqual(16); // a command, not a sentence
      expect(s.hintDesktop.length).toBeLessThanOrEqual(40);
      expect(s.hintTouch.length).toBeLessThanOrEqual(34);
      expect(s.keys).toEqual(KEY_LABELS[s.lanes]);
    }
    expect(script[0].lanes).toBe(1);
    expect(script[script.length - 1].lanes).toBe(6);
    expect(script.filter((s) => s.kind === 'lanes').map((s) => s.lanes)).toEqual([2, 3, 4, 5, 6]);
  });

  it('fills key and zone placeholders per lane count', () => {
    expect(keyHint(1)).toBe('F J');
    expect(keyHint(4)).toBe('D F J K');
    expect(keyHint(6)).toBe('S D F J K L');
    expect(keyHint(9)).toBe('');
    expect(laneKey(4, 1)).toBe('F');
    expect(laneKey(2, 1)).toBe('J');
    expect(laneKey(1, 1)).toBe('F J');
    expect(laneKey(6, 9)).toBe('L');
    expect(laneKey(9, 0)).toBe('');
    expect(zoneHint(1)).toBe('вся нижняя половина экрана');
    expect(zoneHint(2)).toBe('2 зоны внизу');
    expect(zoneHint(5)).toBe('5 зон внизу');
    const script = buildScript(BEATS);
    const four = script.find((s) => s.id === 'lanes4')!;
    expect(four.title).toBe('Полосы: 4');
    // The spell caption names only the spell lane's key, not the whole 4-key row.
    const spell = script.find((s) => s.id === 'spell')!;
    expect(spell.hintDesktop).toBe(`${KEY_LABELS[4][SPELL_LANE]} — и всё замедлится`);
    expect(spell.hintDesktop).not.toContain(keyHint(4));
    // On one lane either key works; the tap hint says so instead of reading as a chord.
    const tap = script.find((s) => s.id === 'tap')!;
    expect(tap.hintDesktop).toBe('Когда нота на линии — F J');
    expect(four.hintDesktop).toBe('Клавиши D F J K');
    expect(four.hintTouch).toBe('Четыре зоны');
    const one = script.find((s) => s.id === 'tap')!;
    expect(one.hintDesktop).toContain('F J');
  });

  it('finds the caption for any song time, including the lead-in', () => {
    const script = buildScript(BEATS);
    expect(script[captionAt(script, -2)].id).toBe('intro');
    expect(script[captionAt(script, 0)].id).toBe('intro');
    const tap = script.find((s) => s.id === 'tap')!;
    expect(captionAt(script, tap.from)).toBe(script.indexOf(tap));
    expect(captionAt(script, tap.to - 1e-6)).toBe(script.indexOf(tap));
    expect(captionAt(script, tap.to)).toBe(script.indexOf(tap) + 1);
    expect(script[captionAt(script, 10_000)].id).toBe('finale');
    expect(captionAt(script, NaN)).toBe(-1);
    expect(captionAt([], 3)).toBe(-1);
  });

  it('reports step progress in 0..1 and handles open-ended steps', () => {
    const script = buildScript(BEATS);
    const hold = script.find((s) => s.id === 'hold')!;
    expect(stepProgress(hold, hold.from - 1)).toBe(0);
    expect(stepProgress(hold, (hold.from + hold.to) / 2)).toBeCloseTo(0.5, 6);
    expect(stepProgress(hold, hold.to + 1)).toBe(1);
    expect(stepProgress(script[0], -5)).toBe(0);
    expect(stepProgress(script[0], script[0].to)).toBe(1);
    expect(stepProgress(script[script.length - 1], 1e9)).toBe(0);
  });
});
