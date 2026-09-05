import { describe, expect, it } from 'vitest';
import { NICKNAME_MAX, sanitizeNickname } from './settingsStore';

describe('sanitizeNickname', () => {
  it('trims, collapses whitespace and strips control characters / angle brackets', () => {
    expect(sanitizeNickname('  Neo   Tap ')).toBe('Neo Tap');
    expect(sanitizeNickname('<b>x</b>')).toBe('bx/b');
    expect(sanitizeNickname('   ')).toBe('');
  });

  it('caps the length', () => {
    expect(sanitizeNickname('a'.repeat(40))).toHaveLength(NICKNAME_MAX);
  });
});
