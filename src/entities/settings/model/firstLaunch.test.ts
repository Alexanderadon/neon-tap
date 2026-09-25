import { describe, expect, it } from 'vitest';
import { firstLaunchStep } from './firstLaunch';

describe('firstLaunchStep', () => {
  it('opens the tutorial until it is done, then nothing', () => {
    expect(firstLaunchStep({ tutorialDone: false })).toBe('tutorial');
    expect(firstLaunchStep({ tutorialDone: true })).toBeNull();
  });

  it('goes straight to the tutorial without a name or calibration', () => {
    const fresh = { nickname: '', calibrated: false, calibrationVersion: 0, tutorialDone: false };
    expect(firstLaunchStep(fresh)).toBe('tutorial');
    expect(firstLaunchStep({ ...fresh, tutorialDone: true })).toBeNull();
  });
});
