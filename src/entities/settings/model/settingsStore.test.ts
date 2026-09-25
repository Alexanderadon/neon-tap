import { describe, expect, it } from 'vitest';
import { NICKNAME_MAX, getSettings, isValidNickname, sanitizeNickname, settingsFromJson, updateSettings } from './settingsStore';

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

  it('starts with the letter avatar and keeps only known avatar ids', () => {
    expect(getSettings().avatar).toBe('');
    updateSettings({ avatar: 'fox' });
    expect(getSettings().avatar).toBe('fox');
    updateSettings({ avatar: 'unicorn' });
    expect(getSettings().avatar).toBe('');
    updateSettings({ avatar: 'owl' });
    updateSettings({ avatar: 42 as unknown as string });
    expect(getSettings().avatar).toBe('');
  });

  it('keeps the avatar when another field changes', () => {
    updateSettings({ avatar: 'panda' });
    updateSettings({ nickname: 'Neo' });
    expect(getSettings().avatar).toBe('panda');
    updateSettings({ avatar: '', nickname: '' });
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

describe('settingsFromJson', () => {
  it('migrates a save from before avatars: the field takes the letter default', () => {
    const s = settingsFromJson(JSON.stringify({ version: 1, nickname: 'Neo', musicVolume: 0.5 }));
    expect(s.avatar).toBe('');
    expect(s.nickname).toBe('Neo');
    expect(s.musicVolume).toBe(0.5);
  });

  it('keeps a known avatar and drops an unknown one', () => {
    expect(settingsFromJson(JSON.stringify({ avatar: 'ghost' })).avatar).toBe('ghost');
    expect(settingsFromJson(JSON.stringify({ avatar: 'zebra' })).avatar).toBe('');
    expect(settingsFromJson(JSON.stringify({ avatar: 7 })).avatar).toBe('');
  });

  it('gives a new install Svetlana at 0.6 and keeps a saved voice volume', () => {
    expect(settingsFromJson(null)).toMatchObject({ voice: 'svetlana', voiceVolume: 0.6 });
    expect(settingsFromJson(JSON.stringify({ voiceVolume: 0.9 })).voiceVolume).toBe(0.9);
  });

  it('moves the retired Dmitry voice to Svetlana and keeps «off»', () => {
    expect(settingsFromJson(JSON.stringify({ voice: 'dmitry' })).voice).toBe('svetlana');
    expect(settingsFromJson(JSON.stringify({ voice: 'off' })).voice).toBe('off');
    expect(settingsFromJson(JSON.stringify({ voice: 42 })).voice).toBe('svetlana');
  });

  it('falls back to the defaults on garbage', () => {
    expect(settingsFromJson('{not json').avatar).toBe('');
    expect(settingsFromJson(null).nickname).toBe('');
  });
});
