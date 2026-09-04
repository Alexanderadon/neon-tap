import { describe, expect, it } from 'vitest';
import { computeLayout, laneAtPoint } from './layout';
import { KEY_LAYOUTS, KEY_LABELS, MAX_LANES, MIN_LANES } from '@/shared/config/constants';

describe('layout', () => {
  it('splits the lane area evenly for any lane count', () => {
    for (let n = MIN_LANES; n <= MAX_LANES; n++) {
      const l = computeLayout(800, 450, false, n);
      expect(l.lanes).toBe(n);
      expect(l.laneWidth * n).toBeCloseTo(l.laneAreaWidth);
      expect(l.noteHeight).toBeGreaterThanOrEqual(14);
    }
  });

  it('maps pointer positions to lanes (desktop inside the area, touch zones full width)', () => {
    const l = computeLayout(800, 450, false, 6);
    expect(laneAtPoint(l, l.laneX + 1, 100, false)).toBe(0);
    expect(laneAtPoint(l, l.laneX + l.laneAreaWidth - 1, 100, false)).toBe(5);
    expect(laneAtPoint(l, 1, 100, false)).toBe(-1);
    const t = computeLayout(375, 812, true, 3);
    expect(laneAtPoint(t, 10, 700, true)).toBe(0);
    expect(laneAtPoint(t, 187, 700, true)).toBe(1);
    expect(laneAtPoint(t, 370, 700, true)).toBe(2);
  });

  it('has a full keyboard layout and labels for every lane count', () => {
    for (let n = MIN_LANES; n <= MAX_LANES; n++) {
      const lanes = new Set(Object.values(KEY_LAYOUTS[n]));
      for (let l = 0; l < n; l++) expect(lanes.has(l)).toBe(true);
      expect(KEY_LABELS[n]).toHaveLength(n);
    }
  });
});
