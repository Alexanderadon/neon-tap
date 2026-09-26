import { describe, expect, it } from 'vitest';
import { calibrationExit } from './exit';

describe('calibration exit', () => {
  it('returns to the settings when they opened the screen, else to the menu', () => {
    expect(calibrationExit('settings')).toBe('settings');
    expect(calibrationExit(undefined)).toBe('menu');
    expect(calibrationExit('menu')).toBe('menu');
  });
});
