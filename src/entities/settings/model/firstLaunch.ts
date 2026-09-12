import { CALIBRATION_VERSION } from '@/shared/config/constants';
import type { Settings } from './settingsStore';

export type FirstLaunchStep = 'welcome' | 'calibration' | 'tutorial';

let welcomeSkipped = false;
/** "Not now" on the welcome screen — remembered for this session only, so the name is asked again next launch. */
export function markWelcomeSkipped(): void {
  welcomeSkipped = true;
}
export function isWelcomeSkipped(): boolean {
  return welcomeSkipped;
}

/**
 * What the app must show before the menu on this device: the name (once, unless skipped this
 * session), then latency calibration (again after a calibration-affecting update), then the tutorial.
 */
export function firstLaunchStep(s: Pick<Settings, 'nickname' | 'calibrated' | 'calibrationVersion' | 'tutorialDone'>, welcomeSkipped = false): FirstLaunchStep | null {
  if (!s.nickname && !welcomeSkipped) return 'welcome';
  if (!s.calibrated || s.calibrationVersion < CALIBRATION_VERSION) return 'calibration';
  if (!s.tutorialDone) return 'tutorial';
  return null;
}
