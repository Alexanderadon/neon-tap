import { describe, expect, it } from 'vitest';
import { CALIBRATION_VERSION } from '@/shared/config/constants';
import { firstLaunchStep } from './firstLaunch';

const done = { nickname: 'Саша', calibrated: true, calibrationVersion: CALIBRATION_VERSION, tutorialDone: true };

describe('firstLaunchStep', () => {
  it('asks for the name first, then calibration, then the tutorial, then nothing', () => {
    expect(firstLaunchStep({ ...done, nickname: '', calibrated: false, tutorialDone: false })).toBe('welcome');
    expect(firstLaunchStep({ ...done, calibrated: false, tutorialDone: false })).toBe('calibration');
    expect(firstLaunchStep({ ...done, tutorialDone: false })).toBe('tutorial');
    expect(firstLaunchStep(done)).toBeNull();
  });

  it('re-runs calibration after a calibration-affecting update', () => {
    expect(firstLaunchStep({ ...done, calibrationVersion: CALIBRATION_VERSION - 1 })).toBe('calibration');
  });

  it('lets a skipped welcome through for the session without saving a name', () => {
    expect(firstLaunchStep({ ...done, nickname: '' }, true)).toBeNull();
    expect(firstLaunchStep({ ...done, nickname: '', calibrated: false }, true)).toBe('calibration');
  });
});
