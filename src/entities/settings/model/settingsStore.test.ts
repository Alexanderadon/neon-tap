import { describe, expect, it } from 'vitest';
import { getSettings, updateSettings } from './settingsStore';

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
