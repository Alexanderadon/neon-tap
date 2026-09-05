import { dict } from '@/shared/i18n';
import { clamp } from '@/shared/lib/math';

/** Mechanic a tutorial step teaches (drives the overlay icon + hint animation). */
export type TutorialKind = 'intro' | 'tap' | 'hold' | 'slide' | 'roll' | 'circle' | 'lanes' | 'free';

export type TutorialStepId = 'intro' | 'tap' | 'alt' | 'hold' | 'slide' | 'roll' | 'circle' | 'lanes' | 'free';

export interface TutorialStep {
  id: TutorialStepId;
  kind: TutorialKind;
  /** Song time (seconds) when the caption appears. */
  from: number;
  /** Song time (seconds) when the next caption takes over. */
  to: number;
  title: string;
  text: string;
  /** Keyboard hint (desktop). */
  hintDesktop: string;
  /** Finger hint (phones). */
  hintTouch: string;
}

/**
 * The tutorial script in beat units of `public/charts/tutorial.json` (the beat grid of
 * "The 9th Circle", ~120 BPM). Each caption starts ~3 beats before its first note — notes take
 * 3.5 beats to fall — and ends where the next one begins. Keep in sync with the chart.
 */
export const TUTORIAL_PLAN: readonly { id: TutorialStepId; kind: TutorialKind; fromBeat: number; toBeat: number }[] = [
  { id: 'intro', kind: 'intro', fromBeat: -Infinity, toBeat: 7 },
  { id: 'tap', kind: 'tap', fromBeat: 7, toBeat: 17 },
  { id: 'alt', kind: 'tap', fromBeat: 17, toBeat: 29 },
  { id: 'hold', kind: 'hold', fromBeat: 29, toBeat: 43 },
  { id: 'slide', kind: 'slide', fromBeat: 43, toBeat: 53 },
  { id: 'roll', kind: 'roll', fromBeat: 53, toBeat: 63 },
  { id: 'circle', kind: 'circle', fromBeat: 63, toBeat: 71.5 },
  { id: 'lanes', kind: 'lanes', fromBeat: 71.5, toBeat: 85 },
  { id: 'free', kind: 'free', fromBeat: 85, toBeat: Infinity },
];

/** Beat index (fractional allowed) → song seconds on a tracked beat grid; extrapolates past the ends. */
export function beatTime(beats: readonly number[], beat: number): number {
  if (!Number.isFinite(beat)) return beat;
  if (beats.length === 0) return beat;
  if (beats.length === 1) return beats[0] + beat * 0.5;
  const i = clamp(Math.floor(beat), 0, beats.length - 2);
  const step = beats[i + 1] - beats[i];
  return beats[i] + (beat - i) * step;
}

/** Resolve the plan against a beat grid into captions with song times. */
export function buildScript(beats: readonly number[]): TutorialStep[] {
  return TUTORIAL_PLAN.map((p) => {
    const copy = dict.tutorialSteps[p.id];
    return {
      id: p.id,
      kind: p.kind,
      from: beatTime(beats, p.fromBeat),
      to: beatTime(beats, p.toBeat),
      title: copy.title,
      text: copy.text,
      hintDesktop: copy.desktop,
      hintTouch: copy.touch,
    };
  });
}

/** Index of the caption active at `songTime`, or -1 (steps are contiguous and sorted). */
export function captionAt(script: readonly TutorialStep[], songTime: number): number {
  if (script.length === 0 || Number.isNaN(songTime)) return -1;
  // Steps are sorted by `from`; the active one is the last whose `from` ≤ songTime.
  let i = -1;
  for (let k = 0; k < script.length; k++) {
    if (script[k].from <= songTime) i = k;
    else break;
  }
  if (i < 0) return -1;
  return songTime < script[i].to ? i : -1;
}

/** 0..1 progress through a step (0 for open-ended starts, 1 once it is over). */
export function stepProgress(step: TutorialStep, songTime: number): number {
  if (!Number.isFinite(step.from) || !Number.isFinite(step.to)) return songTime >= step.to ? 1 : 0;
  const len = step.to - step.from;
  if (len <= 0) return 1;
  return clamp((songTime - step.from) / len, 0, 1);
}
