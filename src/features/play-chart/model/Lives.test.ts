import { describe, expect, it } from 'vitest';
import { Lives } from './Lives';

describe('Lives', () => {
  it('loses a heart per miss and dies at zero', () => {
    const l = new Lives(5);
    for (let i = 0; i < 4; i++) expect(l.miss()).toBe(false);
    expect(l.hearts).toBe(1);
    expect(l.miss()).toBe(true);
    expect(l.dead).toBe(true);
  });

  it('regains a heart after a streak of hits, capped at max', () => {
    const l = new Lives(5, 10);
    l.miss();
    for (let i = 0; i < 9; i++) expect(l.hit()).toBe(false);
    expect(l.hit()).toBe(true);
    expect(l.hearts).toBe(5);
    for (let i = 0; i < 10; i++) l.hit();
    expect(l.hearts).toBe(5);
  });

  it('miss resets the streak; gain respects the cap', () => {
    const l = new Lives(5, 10);
    for (let i = 0; i < 5; i++) l.hit();
    l.miss();
    expect(l.streak).toBe(0);
    expect(l.gain()).toBe(true);
    expect(l.gain()).toBe(false);
  });
});
