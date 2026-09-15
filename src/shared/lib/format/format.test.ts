import { describe, expect, it } from 'vitest';
import { NBSP, THIN_SPACE, formatAccuracy, formatCount, formatDelta, formatScore, initialLetter, percentLabel, volumePercent } from './index';

describe('formatCount / formatScore', () => {
  it('groups thousands with a thin space and rounds', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(758)).toBe('758');
    expect(formatCount(1240)).toBe(`1${THIN_SPACE}240`);
    expect(formatScore(102400)).toBe(`102${THIN_SPACE}400`);
    expect(formatCount(9999.6)).toBe(`10${THIN_SPACE}000`);
  });

  it('writes a proper minus and a plus for deltas', () => {
    expect(formatCount(-12)).toBe('−12');
    expect(formatDelta(35)).toBe('+35');
    expect(formatDelta(-1200)).toBe(`−1${THIN_SPACE}200`);
    expect(formatDelta(0)).toBe('0');
  });
});

describe('formatAccuracy', () => {
  it('writes one decimal with a comma and a space before the sign', () => {
    expect(formatAccuracy(0.9862)).toBe('98,6 %');
    expect(formatAccuracy(1)).toBe('100,0 %');
    expect(formatAccuracy(0)).toBe('0,0 %');
  });
});

describe('volume labels', () => {
  it('clamps and rounds to whole per cent', () => {
    expect(volumePercent(0.9)).toBe(90);
    expect(volumePercent(1.4)).toBe(100);
    expect(volumePercent(-1)).toBe(0);
    expect(volumePercent(Number.NaN)).toBe(0);
  });

  it('keeps the sign on the same line with a no-break space', () => {
    expect(percentLabel(0.5)).toBe(`50${NBSP}%`);
  });
});

describe('initialLetter', () => {
  it('upper-cases the first character and falls back to «?»', () => {
    expect(initialLetter('neo')).toBe('N');
    expect(initialLetter('  ёж ')).toBe('Ё');
    expect(initialLetter('   ')).toBe('?');
  });
});
