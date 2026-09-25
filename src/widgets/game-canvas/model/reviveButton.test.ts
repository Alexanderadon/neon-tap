import { describe, expect, it } from 'vitest';
import { reviveButton } from './reviveButton';

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
    expect(b.sub).toBe('бесплатно с NEON PASS');
    expect(`${b.label} ${b.sub}`).not.toMatch(/реклам/i);
    expect(b.locked).toBe(false);
  });

  it('waits, locked, while the ad plays', () => {
    const b = reviveButton('ad', false);
    expect(b.label).toBe('Реклама');
    expect(b.locked).toBe(true);
    expect(b.icon).toBe('hourglass');
  });

  it('fits a 360 px screen: the caps label about ten letters, the sub line about 21', () => {
    for (const b of [reviveButton('offer', false), reviveButton('offer', true), reviveButton('ad', false)]) {
      expect(b.label.length).toBeLessThanOrEqual(10);
      expect(b.sub.length).toBeLessThanOrEqual(21);
    }
  });
});
