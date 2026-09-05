import { describe, expect, it } from 'vitest';
import { sparklinePoints, toMarker, toPolyline } from './sparkline';

describe('sparkline', () => {
  it('returns nothing for an empty series and centres a single value', () => {
    expect(sparklinePoints([], 100, 40)).toEqual([]);
    const [p] = sparklinePoints([0.9], 100, 40, 0);
    expect(p.x).toBe(50);
    expect(p.y).toBeCloseTo(20);
  });

  it('spreads points left → right and maps higher accuracy to a smaller y', () => {
    const pts = sparklinePoints([0.5, 0.7, 1], 100, 40, 0);
    expect(pts.map((p) => p.x)).toEqual([0, 50, 100]);
    expect(pts[0].y).toBeCloseTo(40);
    expect(pts[2].y).toBeCloseTo(0);
    expect(pts[1].y).toBeGreaterThan(pts[2].y);
  });

  it('keeps at least a 10-point vertical span', () => {
    const pts = sparklinePoints([0.9, 0.92], 100, 100, 0);
    // 2 points over a 0.1 span → 20 px apart, not the full height
    expect(Math.abs(pts[0].y - pts[1].y)).toBeCloseTo(20);
    expect(pts.every((p) => p.y >= 0 && p.y <= 100)).toBe(true);
  });

  it('formats a polyline', () => {
    expect(toPolyline([{ x: 1.234, y: 5 }, { x: 10, y: 2.25 }])).toBe('1.2,5.0 10.0,2.3');
  });

  it('formats a zero-length marker path', () => {
    expect(toMarker({ x: 1.234, y: 5 })).toBe('M1.2,5.0h0');
  });
});
