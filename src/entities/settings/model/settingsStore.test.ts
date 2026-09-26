import { describe, expect, it } from 'vitest';
import { MEET_KINDS, NICKNAME_MAX, getSettings, isValidNickname, sanitizeNickname, settingsFromJson, updateSettings } from './settingsStore';

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

  it('remembers the FX drop until an economy mode is chosen again', () => {
    updateSettings({ fxAuto: 'low' });
    expect(getSettings().fxAuto).toBe('low');
    updateSettings({ musicVolume: 0.5 });
    expect(getSettings().fxAuto).toBe('low');
    updateSettings({ fxMode: 'auto' });
    expect(getSettings().fxAuto).toBe('full');
    updateSettings({ musicVolume: 0.9 });
  });

  it('adds met mechanics once each', () => {
    updateSettings({ seenKinds: ['circle'] });
    updateSettings({ seenKinds: [...getSettings().seenKinds, 'slide', 'circle'] });
    expect(getSettings().seenKinds).toEqual(['slide', 'circle']);
    updateSettings({ seenKinds: [] });
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

  it('gives a new install no met mechanics, no remembered FX drop and an unlearned offset', () => {
    expect(settingsFromJson(null)).toMatchObject({ seenKinds: [], fxAuto: 'full', offsetLearned: false });
  });

  it('counts the old tutorial: a save from before the cards with the tutorial done has met all four mechanics', () => {
    expect(settingsFromJson(JSON.stringify({ tutorialDone: true })).seenKinds).toEqual([...MEET_KINDS]);
    expect(settingsFromJson(JSON.stringify({ tutorialDone: false })).seenKinds).toEqual([]);
    // Once the field is saved it is taken as it is.
    expect(settingsFromJson(JSON.stringify({ tutorialDone: true, seenKinds: ['roll'] })).seenKinds).toEqual(['roll']);
  });

  it('keeps only known mechanic kinds, each once, and strict values for fxAuto and offsetLearned', () => {
    const s = settingsFromJson(JSON.stringify({ seenKinds: ['spin', 'tap', 'spin', 3, 'slide'], fxAuto: 'max', offsetLearned: 'yes' }));
    expect(s.seenKinds).toEqual(['slide', 'spin']);
    expect(s.fxAuto).toBe('full');
    expect(s.offsetLearned).toBe(false);
    expect(settingsFromJson(JSON.stringify({ seenKinds: 'slide', fxAuto: 'low', offsetLearned: true }))).toMatchObject({
      seenKinds: [],
      fxAuto: 'low',
      offsetLearned: true,
    });
  });

  it('lets the latency probe run for everyone but a saved measured calibration', () => {
    expect(settingsFromJson(null).offsetManual).toBe(false);
    // «Пропустить» and the old first-launch flow set `calibrated` without measuring anything.
    expect(settingsFromJson(JSON.stringify({ calibrated: true, calibrationVersion: 3 })).offsetManual).toBe(false);
    expect(settingsFromJson(JSON.stringify({ calibrated: true, offsetManual: true, calibrationVersion: 3, audioOffsetMs: 180 }))).toMatchObject({
      offsetManual: true,
      audioOffsetMs: 180,
    });
    // A stale calibration's offset is dropped, and with it the word that it was measured.
    expect(settingsFromJson(JSON.stringify({ calibrated: true, offsetManual: true, calibrationVersion: 2, audioOffsetMs: 180 }))).toMatchObject({
      offsetManual: false,
      audioOffsetMs: 0,
    });
  });

  it('falls back to the defaults on garbage', () => {
    expect(settingsFromJson('{not json').avatar).toBe('');
    expect(settingsFromJson(null).nickname).toBe('');
  });
});
