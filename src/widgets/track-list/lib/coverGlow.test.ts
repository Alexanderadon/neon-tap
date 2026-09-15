import { describe, expect, it } from 'vitest';
import { cardGlow, hexToRgba } from './coverGlow';

describe('cover glow', () => {
  it('converts long and short hex to rgba and clamps alpha', () => {
    expect(hexToRgba('#ff3b3b', 0.3)).toBe('rgba(255, 59, 59, 0.3)');
    expect(hexToRgba('#0Ff', 2)).toBe('rgba(0, 255, 255, 1)');
    expect(hexToRgba('rebeccapurple', 0.3)).toBe('rebeccapurple');
  });

  it('builds the focused card shadow from the accent', () => {
    expect(cardGlow('#00f0ff')).toBe('0 24px 60px rgba(0, 0, 0, 0.55), 0 0 48px rgba(0, 240, 255, 0.3)');
  });
});
