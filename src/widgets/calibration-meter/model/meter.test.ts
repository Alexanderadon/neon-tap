import { describe, expect, it } from 'vitest';
import { METER_RANGE_MS, meterPercent, shiftKind, signedMs } from './meter';

describe('TapMeter maths', () => {
  it('puts the marker at the centre for 0 and scales ±150 ms to the ends', () => {
    expect(meterPercent(0)).toBe(50);
    expect(meterPercent(METER_RANGE_MS)).toBe(100);
    expect(meterPercent(-METER_RANGE_MS)).toBe(0);
    expect(meterPercent(75)).toBe(75);
    expect(meterPercent(12)).toBeCloseTo(54);
  });

  it('clamps out-of-range and non-finite values', () => {
    expect(meterPercent(900)).toBe(100);
    expect(meterPercent(-900)).toBe(0);
    expect(meterPercent(Number.NaN)).toBe(50);
  });

  it('formats a signed millisecond value', () => {
    expect(signedMs(12)).toBe('+12');
    expect(signedMs(-38)).toBe('−38');
    expect(signedMs(0)).toBe('0');
    expect(signedMs(0.4)).toBe('0');
    expect(signedMs(-0.6)).toBe('−1');
  });

  it('classifies the shift for the explanation line', () => {
    expect(shiftKind(38)).toBe('late');
    expect(shiftKind(-20)).toBe('early');
    expect(shiftKind(0)).toBe('none');
  });
});
