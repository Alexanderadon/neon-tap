import { describe, expect, it } from 'vitest';
import { computeLayout, laneAtPoint, MIN_TOUCH_ZONE_PX, touchZoneRect, touchZoneWidth, touchZonesComfortable } from './layout';
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

describe('touch zones', () => {
  const phones = [
    { name: 'iPhone SE', w: 375, h: 667 },
    { name: 'iPhone 14', w: 390, h: 844 },
    { name: 'small Android', w: 360, h: 780 },
    { name: 'narrowest', w: 320, h: 568 },
  ];

  it('portrait: zones coincide with the lanes and every zone is ≥ 48 px for 3/4/5 lanes', () => {
    for (const { w, h } of phones) {
      for (const n of [3, 4, 5]) {
        const L = computeLayout(w, h, true, n);
        expect(L.portrait).toBe(true);
        expect(L.laneAreaWidth).toBe(w);
        expect(touchZoneWidth(L)).toBeCloseTo(L.laneWidth);
        expect(touchZonesComfortable(L)).toBe(true);
        expect(touchZoneWidth(L)).toBeGreaterThanOrEqual(MIN_TOUCH_ZONE_PX);
        // The touch zone sits below the hit line's approach: hit line at 80 % height, zone from 50 %.
        expect(L.touchZoneTop).toBe(h * 0.5);
        expect(L.hitY).toBeGreaterThan(L.touchZoneTop);
      }
    }
  });

  it('even the 6-lane layout stays ≥ 48 px on a 320 px phone', () => {
    const L = computeLayout(320, 568, true, MAX_LANES);
    expect(touchZoneWidth(L)).toBeGreaterThanOrEqual(MIN_TOUCH_ZONE_PX);
  });

  it('zone rectangles tile the bottom half exactly', () => {
    const L = computeLayout(390, 844, true, 5);
    let x = 0;
    for (let i = 0; i < 5; i++) {
      const z = touchZoneRect(L, i);
      expect(z.x).toBeCloseTo(x);
      expect(z.y).toBe(L.touchZoneTop);
      expect(z.height).toBe(L.height - L.touchZoneTop);
      x += z.width;
    }
    expect(x).toBeCloseTo(390);
  });

  it('every point of a zone maps back to its lane; exact borders belong to the right-hand zone', () => {
    for (const n of [3, 4, 5]) {
      const L = computeLayout(375, 812, true, n);
      const w = touchZoneWidth(L);
      for (let i = 0; i < n; i++) {
        const z = touchZoneRect(L, i);
        expect(laneAtPoint(L, z.x + 0.5, z.y, true)).toBe(i);
        expect(laneAtPoint(L, z.x + z.width - 0.5, L.height - 1, true)).toBe(i);
        expect(laneAtPoint(L, z.x + z.width / 2, z.y + z.height / 2, true)).toBe(i);
      }
      // Shared border x = i·w → zone i (floor), the last border x = width clamps to the last lane.
      for (let i = 1; i < n; i++) expect(laneAtPoint(L, i * w, 700, true)).toBe(i);
      expect(laneAtPoint(L, L.width, 700, true)).toBe(n - 1);
      expect(laneAtPoint(L, -5, 700, true)).toBe(0);
      expect(laneAtPoint(L, L.width + 50, 700, true)).toBe(n - 1);
    }
  });

  it('touch above the zones still hits the lane under the finger (portrait)', () => {
    const L = computeLayout(375, 812, true, 4);
    expect(laneAtPoint(L, 10, 100, true)).toBe(0);
    expect(laneAtPoint(L, 370, 100, true)).toBe(3);
    // Just above the zone top uses lane geometry, just below uses zones — same answer in portrait.
    expect(laneAtPoint(L, 200, L.touchZoneTop - 1, true)).toBe(laneAtPoint(L, 200, L.touchZoneTop, true));
  });

  it('landscape touch: lanes are centred but zones stay full width; outside the lanes falls back to zones', () => {
    const L = computeLayout(844, 390, true, 4);
    expect(L.portrait).toBe(false);
    expect(L.laneAreaWidth).toBeLessThan(L.width);
    expect(L.laneX).toBeGreaterThan(0);
    expect(touchZoneWidth(L)).toBe(211);
    // Bottom half: full-width zones.
    expect(laneAtPoint(L, 5, 300, true)).toBe(0);
    expect(laneAtPoint(L, 839, 300, true)).toBe(3);
    // Top half, left of the lane area: nearest zone rather than -1 (a finger never "misses" on touch).
    expect(laneAtPoint(L, 5, 50, true)).toBe(0);
    // Top half inside the lane area: lane geometry.
    expect(laneAtPoint(L, L.laneX + L.laneWidth * 1.5, 50, true)).toBe(1);
    // Desktop landscape still returns -1 outside the lanes.
    const D = computeLayout(844, 390, false, 4);
    expect(laneAtPoint(D, 5, 50, false)).toBe(-1);
    expect(laneAtPoint(D, 5, 300, false)).toBe(-1);
  });

  it('touch layouts move the hit line lower (80 %) than desktop (86 %)', () => {
    expect(computeLayout(375, 812, true, 4).hitY).toBe(Math.round(812 * 0.8));
    expect(computeLayout(375, 812, false, 4).hitY).toBe(Math.round(812 * 0.86));
  });
});
