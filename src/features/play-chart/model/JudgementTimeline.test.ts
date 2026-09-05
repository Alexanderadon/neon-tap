import { describe, expect, it } from 'vitest';
import { countJudgements, parseChartLevel } from '@/entities/chart';
import { Scoring } from '@/entities/score';
import { JudgementTimeline, JUDGEMENT_CODES } from './JudgementTimeline';
import { NoteManager } from './NoteManager';

describe('JudgementTimeline', () => {
  it('records time (centiseconds), judgement and combo, and converts once', () => {
    const tl = new JudgementTimeline(4);
    tl.record(1.234, 'perfect', 1);
    tl.record(2.5, 'great', 2);
    tl.record(3.999, 'miss', 0);
    expect(tl.count).toBe(3);
    expect(tl.capacity).toBe(4);
    expect(tl.toResult()).toEqual({ t: [1.23, 2.5, 4], j: ['perfect', 'great', 'miss'], combo: [1, 2, 0] });
  });

  it('drops entries beyond capacity instead of throwing, and resets', () => {
    const tl = new JudgementTimeline(1);
    tl.record(0, 'good', 1);
    tl.record(1, 'good', 2);
    expect(tl.count).toBe(1);
    expect(tl.toResult().j).toEqual(['good']);
    tl.reset();
    expect(tl.count).toBe(0);
    expect(tl.toResult()).toEqual({ t: [], j: [], combo: [] });
  });

  it('clamps negative times and oversized combos', () => {
    const tl = new JudgementTimeline(2);
    tl.record(-1.5, 'perfect', 70000);
    tl.record(5, 'perfect', -3);
    expect(tl.toResult()).toEqual({ t: [0, 5], j: ['perfect', 'perfect'], combo: [0xffff, 0] });
  });

  it('every judgement has a byte code', () => {
    expect(JUDGEMENT_CODES).toEqual(['perfect', 'great', 'good', 'miss']);
    expect(new JudgementTimeline(0).capacity).toBe(0);
  });

  it('records a NoteManager run judgement by judgement, sized by countJudgements', () => {
    const notes = parseChartLevel({ stars: 1, notes: [[1, 0], [2, 1], [3, 2, 1], [5, 3]] });
    const total = countJudgements(notes);
    expect(total).toBe(5);
    const tl = new JudgementTimeline(total);
    const scoring = new Scoring(total);
    const nm = new NoteManager(16);
    nm.load(notes);
    let clock = 0;
    nm.onJudge = ({ judgement }) => {
      scoring.register(judgement);
      tl.record(clock, judgement, scoring.combo);
    };
    const held = () => true;
    clock = 1.02;
    nm.press(0, 1.02); // perfect
    clock = 2.08;
    nm.press(1, 2.08); // great
    clock = 3.0;
    nm.press(2, 3.0); // hold head
    clock = 4.0;
    nm.update(4.0, held); // hold tail completes
    clock = 5.5;
    nm.update(5.5, held); // note at 5 overdue → miss
    const r = tl.toResult();
    expect(r.j).toEqual(['perfect', 'great', 'perfect', 'perfect', 'miss']);
    expect(r.t).toEqual([1.02, 2.08, 3, 4, 5.5]);
    expect(r.combo).toEqual([1, 2, 3, 4, 0]);
    expect(tl.count).toBe(total);
  });
});
