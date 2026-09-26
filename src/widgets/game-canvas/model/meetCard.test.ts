import { describe, expect, it } from 'vitest';
import type { Meeting } from '@/features/play-chart';
import { meetCard, meetProgress } from './meetCard';

const meeting = (over: Partial<Meeting>): Meeting => ({ kind: 'slide', lanes: 4, lane: 1, extra: 2, at: 10, from: 9, to: 12, ...over });

describe('meetCard', () => {
  it('names the slide by the keys of the lanes it really crosses', () => {
    const card = meetCard(meeting({ lanes: 4, lane: 1, extra: 2 }));
    expect(card).toMatchObject({ id: 'meet-slide', kind: 'slide', lanes: 4, title: 'Веди' });
    expect(card.hintDesktop).toBe('Держи F и зажми J');
    expect(card.hintTouch).toBe('Веди палец в соседнюю зону');
  });

  it('puts the roll on its key and keeps the circle and spinner hints as they are', () => {
    expect(meetCard(meeting({ kind: 'roll', lanes: 5, lane: 2, extra: 6 })).hintDesktop).toBe('G — столько раз, сколько на ноте');
    expect(meetCard(meeting({ kind: 'circle' })).hintDesktop).toBe('Пробел, когда круг заполнится');
    expect(meetCard(meeting({ kind: 'spin' })).title).toBe('Крути');
  });

  it('never leaves a placeholder in the text', () => {
    for (const kind of ['slide', 'roll', 'circle', 'spin'] as const) {
      const card = meetCard(meeting({ kind, lanes: 6, lane: 5, extra: 4 }));
      expect(`${card.title} ${card.hintDesktop} ${card.hintTouch}`).not.toMatch(/[{}]/);
    }
  });
});

describe('meetProgress', () => {
  it('runs 0 → 1 over the card’s time on screen', () => {
    const m = meeting({ from: 9, to: 12 });
    expect(meetProgress(m, 8)).toBe(0);
    expect(meetProgress(m, 10.5)).toBe(0.5);
    expect(meetProgress(m, 13)).toBe(1);
  });
});
