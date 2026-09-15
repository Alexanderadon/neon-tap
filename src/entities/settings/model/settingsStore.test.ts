import { describe, expect, it } from 'vitest';
import { NICKNAME_MAX, getSettings, isValidNickname, sanitizeNickname, updateSettings } from './settingsStore';

describe('settingsStore', () => {
  it('starts with the tutorial not done', () => {
    expect(getSettings().tutorialDone).toBe(false);
  });

  it('sanitizes tutorialDone to a strict boolean', () => {
    updateSettings({ tutorialDone: 'yes' as unknown as boolean });
    expect(getSettings().tutorialDone).toBe(false);
    updateSettings({ tutorialDone: true });
    expect(getSettings().tutorialDone).toBe(true);
    updateSettings({ tutorialDone: false });
    expect(getSettings().tutorialDone).toBe(false);
  });

  it('keeps the other fields intact when marking the tutorial done', () => {
    const before = getSettings();
    updateSettings({ tutorialDone: true });
    const after = getSettings();
    expect({ ...after, tutorialDone: false }).toEqual({ ...before, tutorialDone: false });
    updateSettings({ tutorialDone: false });
  });
});

describe('isValidNickname', () => {
  it('accepts anything non-empty once trimmed', () => {
    expect(isValidNickname('  ')).toBe(false);
    expect(isValidNickname('Neo')).toBe(true);
  });
});

describe('sanitizeNickname', () => {
  it('trims, collapses whitespace and strips control characters / angle brackets', () => {
    expect(sanitizeNickname('  Neo   Tap ')).toBe('Neo Tap');
    expect(sanitizeNickname('<b>x</b>')).toBe('bx/b');
    expect(sanitizeNickname('   ')).toBe('');
  });

  it('caps the length', () => {
    expect(sanitizeNickname('a'.repeat(40))).toHaveLength(NICKNAME_MAX);
  });
});
