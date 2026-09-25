import { describe, expect, it } from 'vitest';
import { reviveButton } from './reviveButton';

/**
 * Room at 360 px: the 20 px caps label holds about ten letters (the «ПРОДОЛЖИТЬ» that already fits
 * there); the sub line (Unbounded 700, 13 px) has 208 px. 31d1a7f measured «+5 сердец · 30
 * кристаллов» — 25 signs — at 222 px, ≈ 8.9 px a sign, so 208 px hold ≈ 23 average signs. The budget
 * is 19 units with every Latin capital counted as 1.5 (the widest glyphs of the face): about 35 px to
 * spare, not a count that sits on the edge.
 */
const LABEL_SIGNS = 10;
const SUB_UNITS = 19;
const units = (s: string): number => [...s].reduce((n, ch) => n + (/[A-Z]/.test(ch) ? 1.5 : 1), 0);

describe('second-chance button', () => {
  it('without NEON PASS says it is an ad and what it gives, before anything plays', () => {
    const b = reviveButton('offer', false);
    expect(`${b.label} ${b.sub}`).toBe('Смотреть рекламу · +5 сердец');
    expect(b.icon).toBe('ad');
    expect(b.locked).toBe(false);
  });

  it('with NEON PASS is free and mentions no ad', () => {
    const b = reviveButton('offer', true);
    expect(b.label).toBe('Продолжить');
    expect(b.sub).toBe('бесплатно с PASS');
    expect(`${b.label} ${b.sub}`).not.toMatch(/реклам/i);
    expect(b.locked).toBe(false);
  });

  it('waits, locked, while the ad plays', () => {
    const b = reviveButton('ad', false);
    expect(b.label).toBe('Реклама');
    expect(b.locked).toBe(true);
    expect(b.icon).toBe('hourglass');
  });

  it('fits a 360 px screen with room to spare', () => {
    for (const b of [reviveButton('offer', false), reviveButton('offer', true), reviveButton('ad', false)]) {
      expect(b.label.length, b.label).toBeLessThanOrEqual(LABEL_SIGNS);
      expect(units(b.sub), b.sub).toBeLessThanOrEqual(SUB_UNITS);
    }
    // «бесплатно с NEON PASS» would not: its eight Latin capitals take it to the edge of the line.
    expect(units('бесплатно с NEON PASS')).toBeGreaterThan(SUB_UNITS);
  });
});
