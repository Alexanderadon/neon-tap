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

  it('regains a heart after a streak of hits, capped at the five shown', () => {
    const l = new Lives(5, 10);
    l.miss();
    for (let i = 0; i < 9; i++) expect(l.hit()).toBe(false);
    expect(l.hit()).toBe(true);
    expect(l.hearts).toBe(5);
    for (let i = 0; i < 10; i++) l.hit();
    expect(l.hearts).toBe(5);
    expect(l.gold).toBe(0);
  });

  it('miss resets the streak; gain respects the shown cap', () => {
    const l = new Lives(5, 10);
    for (let i = 0; i < 5; i++) l.hit();
    l.miss();
    expect(l.streak).toBe(0);
    expect(l.gain()).toBe(true);
    expect(l.gain()).toBe(false);
  });

  it('caught hearts gild the shown ones up to ten lives, then overflow; a miss takes a gilded heart first', () => {
    const l = new Lives(5);
    for (let i = 0; i < 5; i++) expect(l.catchHeart()).toBe(true);
    expect(l.hearts).toBe(10);
    expect(l.gold).toBe(5);
    expect(l.catchHeart()).toBe(false); // the eleventh overflows
    expect(l.hearts).toBe(10);
    expect(l.miss()).toBe(false);
    expect(l.gold).toBe(4);
    expect(l.hearts).toBe(9);
    for (let i = 0; i < 8; i++) l.miss();
    expect(l.hearts).toBe(1);
    expect(l.gold).toBe(0);
  });
});
