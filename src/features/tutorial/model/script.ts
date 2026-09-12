import { KEY_LABELS, MAX_LANES, MIN_LANES } from '@/shared/config/constants';
import { dict, fmt, plural } from '@/shared/i18n';
import { clamp } from '@/shared/lib/math';

/** Mechanic a tutorial step teaches (drives the overlay icon + hint animation). */
export type TutorialKind = 'intro' | 'tap' | 'hold' | 'slide' | 'roll' | 'circle' | 'spell' | 'lanes' | 'free';

export type TutorialStepId =
  | 'intro'
  | 'tap'
  | 'hold'
  | 'lanes2'
  | 'alt'
  | 'slide'
  | 'lanes3'
  | 'roll'
  | 'lanes4'
  | 'circle'
  | 'spell'
  | 'lanes5'
  | 'mixed'
  | 'lanes6'
  | 'finale';

export interface TutorialStep {
  id: TutorialStepId;
  kind: TutorialKind;
  /** Lane count of the playfield during this step (1–6). */
  lanes: number;
  /** Key caps for that lane count (`KEY_LABELS[lanes]`), left to right. */
  keys: readonly string[];
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

export interface TutorialPlanEntry {
  id: TutorialStepId;
  kind: TutorialKind;
  lanes: number;
  fromBeat: number;
  toBeat: number;
}

/**
 * The tutorial script in beat units of `public/charts/tutorial.json` (the beat grid of
 * "Apparatus Overlord", ~120 BPM): a lane-count journey 1 → 2 → 3 → 4 → 5 → 6. Every section
 * is introduced by a `lanes` step that sits over the lane-morph transition (the previous
 * step's last note is gone, the section starts 2 beats later) and is followed by the
 * mechanics taught on that many lanes. Each mechanic caption starts ≥ 2 beats before its
 * first note lands — notes take 3.5 beats to fall — and ends where the next one begins.
 * Keep in sync with the chart (`chart.test.ts` checks every rule below).
 */
export const TUTORIAL_PLAN: readonly TutorialPlanEntry[] = [
  { id: 'intro', kind: 'intro', lanes: 1, fromBeat: -Infinity, toBeat: 7 },
  { id: 'tap', kind: 'tap', lanes: 1, fromBeat: 7, toBeat: 19 },
  { id: 'hold', kind: 'hold', lanes: 1, fromBeat: 19, toBeat: 30.25 },
  { id: 'lanes2', kind: 'lanes', lanes: 2, fromBeat: 30.25, toBeat: 34 },
  { id: 'alt', kind: 'tap', lanes: 2, fromBeat: 34, toBeat: 44 },
  { id: 'slide', kind: 'slide', lanes: 2, fromBeat: 44, toBeat: 52.25 },
  { id: 'lanes3', kind: 'lanes', lanes: 3, fromBeat: 52.25, toBeat: 57 },
  { id: 'roll', kind: 'roll', lanes: 3, fromBeat: 57, toBeat: 68.25 },
  { id: 'lanes4', kind: 'lanes', lanes: 4, fromBeat: 68.25, toBeat: 73 },
  { id: 'circle', kind: 'circle', lanes: 4, fromBeat: 73, toBeat: 81 },
  { id: 'spell', kind: 'spell', lanes: 4, fromBeat: 81, toBeat: 91.25 },
  { id: 'lanes5', kind: 'lanes', lanes: 5, fromBeat: 91.25, toBeat: 96 },
  { id: 'mixed', kind: 'free', lanes: 5, fromBeat: 96, toBeat: 113.75 },
  { id: 'lanes6', kind: 'lanes', lanes: 6, fromBeat: 113.75, toBeat: 118 },
  { id: 'finale', kind: 'free', lanes: 6, fromBeat: 118, toBeat: Infinity },
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

/** Song seconds → fractional beat index on the grid (inverse of `beatTime`, same extrapolation). */
export function beatIndex(beats: readonly number[], time: number): number {
  if (!Number.isFinite(time)) return time;
  if (beats.length === 0) return time;
  if (beats.length === 1) return (time - beats[0]) / 0.5;
  let i = 0;
  while (i < beats.length - 2 && beats[i + 1] <= time) i++;
  const step = beats[i + 1] - beats[i];
  return i + (time - beats[i]) / step;
}

/** Lane the tutorial's slow-motion spell falls into (the chart puts it on the 4-lane section). */
export const SPELL_LANE = 1;

/** Key caps for a lane count, e.g. "D F J" (used in captions and the lanes chip). */
export function keyHint(lanes: number): string {
  return (KEY_LABELS[lanes] ?? []).join(' ');
}

/** Key cap of one lane for a lane count, e.g. lane 1 of 4 → "F" (used by `{key}` in captions). */
export function laneKey(lanes: number, lane: number): string {
  const keys = KEY_LABELS[lanes] ?? [];
  return keys[clamp(lane, 0, Math.max(0, keys.length - 1))] ?? '';
}

/** Touch-zone hint for a lane count, e.g. "3 зоны внизу". */
export function zoneHint(lanes: number): string {
  return lanes === 1 ? dict.tutorialZoneSingle : fmt(dict.tutorialZones, { n: lanes, noun: plural(lanes, dict.zonesNoun) });
}

/** Resolve the plan against a beat grid into captions with song times. */
export function buildScript(beats: readonly number[]): TutorialStep[] {
  return TUTORIAL_PLAN.map((p) => {
    const copy = dict.tutorialLaneSteps[p.id];
    const lanes = clamp(p.lanes, MIN_LANES, MAX_LANES);
    // `{keys}` — all key caps of the section, `{key}` — the cap of the spell lane only.
    const params = { n: lanes, keys: keyHint(lanes), key: laneKey(lanes, SPELL_LANE), zones: zoneHint(lanes) };
    return {
      id: p.id,
      kind: p.kind,
      lanes,
      keys: KEY_LABELS[lanes] ?? [],
      from: beatTime(beats, p.fromBeat),
      to: beatTime(beats, p.toBeat),
      title: fmt(copy.title, params),
      text: fmt(copy.text, params),
      hintDesktop: fmt(copy.desktop, params),
      hintTouch: fmt(copy.touch, params),
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
