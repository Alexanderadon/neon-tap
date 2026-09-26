import { KEY_LABELS, MAX_LANES, MIN_LANES } from '@/shared/config/constants';
import { dict, fmt, plural } from '@/shared/i18n';
import { clamp } from '@/shared/lib/math';
import { beatTime, beatIndex } from '@/entities/chart';
export { beatTime, beatIndex };

/** Mechanic a tutorial step teaches (drives the overlay icon + hint animation). The ones past `lanes` are not in the tutorial any more but keep their cards for the first-meeting hints. */
export type TutorialKind = 'intro' | 'tap' | 'hold' | 'lanes' | 'heart' | 'free' | 'slide' | 'roll' | 'circle' | 'spell' | 'spin';

export type TutorialStepId = 'intro' | 'tap' | 'hold' | 'lanes2' | 'alt' | 'lanes3' | 'lanes4' | 'spell' | 'finale';

export interface TutorialStep {
  id: TutorialStepId;
  kind: TutorialKind;
  /** Lane count of the playfield during this step (1–4). */
  lanes: number;
  /** Key caps for that lane count (`KEY_LABELS[lanes]`), left to right. */
  keys: readonly string[];
  /** Song time (seconds) when the caption appears. */
  from: number;
  /** Song time (seconds) when the next caption takes over. */
  to: number;
  title: string;
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
 * "Apparatus Overlord", ~120 BPM): nine steps, ~40 s, only what chapter 1 has — taps and holds on
 * one lane, then 2 → 3 → 4 lanes, and a heart. A `lanes` step starts where the previous step's last
 * note ends, sits over the lane-morph transition and carries a few notes of its own on the new lanes.
 * Every caption starts ≥ 2 beats before its first note lands (notes take 3.5 beats to fall); the steps
 * that replay (`REPLAY_STEPS`) start ≥ 3.5 beats before it, so a rewind shows the whole fall. The
 * finale has no notes: it is the «Готово!» frame the page opens when the run ends.
 * Keep in sync with the chart (`chart.test.ts` checks every rule below).
 */
export const TUTORIAL_PLAN: readonly TutorialPlanEntry[] = [
  { id: 'intro', kind: 'intro', lanes: 1, fromBeat: -Infinity, toBeat: 4 },
  { id: 'tap', kind: 'tap', lanes: 1, fromBeat: 4, toBeat: 16 },
  { id: 'hold', kind: 'hold', lanes: 1, fromBeat: 16, toBeat: 28 },
  { id: 'lanes2', kind: 'lanes', lanes: 2, fromBeat: 28, toBeat: 36 },
  { id: 'alt', kind: 'tap', lanes: 2, fromBeat: 36, toBeat: 44 },
  { id: 'lanes3', kind: 'lanes', lanes: 3, fromBeat: 44, toBeat: 54 },
  { id: 'lanes4', kind: 'lanes', lanes: 4, fromBeat: 54, toBeat: 64 },
  { id: 'spell', kind: 'heart', lanes: 4, fromBeat: 64, toBeat: 74 },
  { id: 'finale', kind: 'free', lanes: 4, fromBeat: 74, toBeat: Infinity },
];

/** Lane the tutorial's heart falls into (the chart puts it on the 4-lane section). */
export const SPELL_LANE = 1;

/** Steps that play once more when the player landed nothing in them. */
export const REPLAY_STEPS: ReadonlySet<TutorialStepId> = new Set<TutorialStepId>(['tap', 'hold', 'lanes2']);

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
    const copy = dict.tutorialSteps[p.id];
    const lanes = clamp(p.lanes, MIN_LANES, MAX_LANES);
    // `{keys}` — all key caps of the section, `{key}` — the cap of the heart's lane only.
    const params = { n: lanes, keys: keyHint(lanes), key: laneKey(lanes, SPELL_LANE), zones: zoneHint(lanes) };
    return {
      id: p.id,
      kind: p.kind,
      lanes,
      keys: KEY_LABELS[lanes] ?? [],
      from: beatTime(beats, p.fromBeat),
      to: beatTime(beats, p.toBeat),
      title: fmt(copy.title, params),
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

/**
 * The replay rule. `hits` and `replayed` are bitmasks over the script (bit i = step i). When the song
 * has just left a step of `REPLAY_STEPS` (it is in the next step now) with no hit in it and the step
 * has not been replayed yet, the step plays once more: returns its index and the song time to rewind
 * to (the step's start). Null otherwise — a step replays at most once, however it goes the second time.
 */
export function replayDue(script: readonly TutorialStep[], songTime: number, hits: number, replayed: number): { index: number; at: number } | null {
  const now = captionAt(script, songTime);
  const i = now - 1;
  if (i < 0) return null;
  const step = script[i];
  if (!REPLAY_STEPS.has(step.id) || (hits & (1 << i)) !== 0 || (replayed & (1 << i)) !== 0) return null;
  return { index: i, at: Math.max(0, step.from) };
}
