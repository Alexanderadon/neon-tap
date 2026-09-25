import type { Settings } from './settingsStore';

export type FirstLaunchStep = 'tutorial';

/**
 * What the app must show before the menu on this device: the tutorial (a first song with hints),
 * until it is finished or skipped once. The name is asked where it is needed (the result screen,
 * duels); latency calibration lives in the settings — the game tunes the latency on its own.
 */
export function firstLaunchStep(s: Pick<Settings, 'tutorialDone'>): FirstLaunchStep | null {
  return s.tutorialDone ? null : 'tutorial';
}
