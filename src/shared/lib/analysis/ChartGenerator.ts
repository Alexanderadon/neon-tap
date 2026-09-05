import {
  DENSITY_LIMIT,
  LANE_COUNT,
  MAX_LANES,
  MIN_LANES,
} from "@/shared/config/constants";
import { percentile } from "@/shared/lib/math";
import type {
  ChartLevel,
  NoteKind,
  NoteTuple,
  SectionTuple,
  SpellKind,
} from "@/shared/types/chart";
import { STEPS_PER_BAR, type Slot, type SongAnalysis } from "./SongAnalyzer";

/**
 * Chart composer: turns the analysed beat grid into ONE playable, musical chart per song.
 *
 * The player must feel they are playing the music themselves, so notes reproduce the rhythmic
 * figure the ear hears — "ту ту ТУ ту ту ТУ" → tap tap TAP tap tap TAP — the same way in every
 * bar of a phrase. For each 4-bar phrase the *rhythm profile* (per-step mean of boosted onset
 * salience over its bars) is peak-picked into *pattern steps*; every bar of the phrase gets a
 * note on each pattern step where that bar actually sounds. Accents (the loudest steps of the
 * profile, the "ТУ") become chords; very strong hits off the pattern (fills, stabs) are added on
 * their own. Then the song's structure adds the mechanics: sustained melodic sounds → holds
 * (some of them slides into a neighbouring lane), drum fills → rolls, intense phrase starts →
 * circle-only windows that follow the same pattern, phrases → lane-count changes (2–6 lanes).
 * Density follows the music (per-bar caps by intensity, a rolling per-second cap), and
 * everything is playable with two thumbs.
 */

export type Category = "rest" | "base" | "sync" | "eighth" | "fill";

export interface Template {
  id: string;
  mask: string;
  category: Category;
  count: number;
}

const T = (id: string, mask: string, category: Category): Template => ({
  id,
  mask,
  category,
  count: mask.split("1").length - 1,
});

/** 16 steps per bar; `1` = note. Read as four beats of four sixteenths. (Reference figures, used by tests / tooling.) */
export const TEMPLATES: readonly Template[] = [
  T("rest", "0000000000000000", "rest"),
  T("half", "1000000010000000", "base"),
  T("quarter", "1000100010001000", "base"),
  T("q-pickup", "1000100010001010", "base"),
  T("q-2and4", "1000101010001010", "base"),
  T("tresillo", "1001001010010010", "sync"),
  T("offbeat", "0010001000100010", "sync"),
  T("sync-a", "1000001010000010", "sync"),
  T("sync-b", "1010001010100010", "sync"),
  T("eighth", "1010101010101010", "eighth"),
  T("e-rest4", "1010101010100000", "eighth"),
  T("e-fill", "1010101010101111", "fill"),
  T("q-fill", "1000100010001111", "fill"),
  T("q-fill2", "1000100011111111", "fill"),
];

/** A rhythm phrase: the pattern is computed over this many bars and repeated in each of them. */
export const PHRASE_BARS = 4;
/** Max notes per bar by intensity [quiet, medium, intense]. */
const MAX_NOTES: readonly [number, number, number] = [3, 6, 9];
/** Fewer lanes → fewer notes per bar. */
const MAX_NOTES_BY_LANES: Record<number, number> = { 2: 4, 3: 6 };
/** Rolling 1-second cap by bar intensity; intense bars of energetic songs go up to DENSITY_LIMIT. */
const DENSITY_BY_INTENSITY: readonly [number, number, number] = [3, 4, 4.5];
/** Slots of silence before a lane-count change so the player can move their hands (2 beats). */
const SECTION_GAP_SLOTS = 8;
/** Notes on (near-)silent slots are dropped — a note with nothing to hear feels random. */
const MIN_NOTE_STRENGTH = 0.1;
/** Absolute floor on raw onset strength: below this a slot is silence, whatever the phrase boost says. */
const MIN_RAW_STRENGTH = 0.05;
/** A profile step joins the pattern when it is a local peak reaching this share of the profile's max. */
const PATTERN_REL = 0.4;
/** Pattern steps this loud (share of profile max) are accents — the "ТУ": chords when a thumb is free. */
const ACCENT_REL = 0.85;
/** In intense phrases a step next to a peak still joins the pattern when this loud — a sixteenth pair ("ta-ka"). */
const PAIR_REL = 0.7;
/** A bar "sounds" a pattern step when its own salience reaches this share of the profile at that step. */
const SOUND_REL = 0.5;
/** Off-pattern hits are added only when very strong: fills, stabs, accents the figure did not predict. */
const EXTRA_REL = 0.85;
/** Min gap between plain notes: a sixteenth inside intense bars, an eighth elsewhere. */
const MIN_GAP_INTENSE = 1;
const MIN_GAP_SLOTS = 2;
/** Quiet phrases are scaled so their own peaks reach this salience. */
const BOOST_TARGET = 0.65;
const MAX_BOOST = 10;
/** A song is energetic when its mean bar intensity reaches this: denser, more lane changes. */
const ENERGETIC_MEAN_INTENSITY = 1.2;

/**
 * Salience = what a listener would tap along to: kicks, snares and melody count fully,
 * hi-hat-only ticks (energy almost all above 2 kHz) count much less.
 */
export function salience(s: Slot): number {
  return s.strength * (0.5 + 0.5 * (1 - s.high));
}

const HOLD_CHANCE = [0.9, 0.7, 0.45] as const; // by intensity
const HOLD_BUDGET = 3;
const MAX_HOLD_SLOTS = 16;
/** Share of long holds (≥ 1 beat) that become slides into a neighbouring lane. */
const SLIDE_CHANCE = 0.4;
/** Two-finger rule: at most ONE hold-type note (hold / roll / slide) at a time, chords only while nothing is held. */
const MAX_ACTIVE_HOLDS = 1;
const MAX_CHORD = 2;
/** Rolls: a fill of ≥ this many sixteenths becomes one roll note; taps are capped. */
const ROLL_MIN_TAPS = 3;
const ROLL_MAX_TAPS = 6;
/** Every slot of a fill must be at least this audible (boosted salience), and the run this loud on average. */
const ROLL_SLOT_SALIENCE = 0.18;
const ROLL_MEAN_SALIENCE = 0.32;
/** Off-sixteenths inside the fill must be this many times louder than off-sixteenths in the rest of the bar. */
const ROLL_CONTRAST = 1.5;
/** Streams: the last bar of an intense phrase whose pattern has four audible eighths on the second half ends in a 4-tap roll. */
const ROLL_STREAM_MIN_STRENGTH = 0.35;
const ROLL_COOLDOWN_BARS = 2;
/** A roll never asks for more than this many taps per second (fast songs get fewer taps, or no roll at all). */
const ROLL_MAX_TAPS_PER_SEC = 6;
/** Sustained bass-heavy sounds (drops, rumbles) become rolls this often (decided per phrase step, so the figure repeats). */
const ROLL_ON_BASS_CHANCE = 0.5;

/** A spell note every this many bars, starting at bar 4 (after the intro). */
const SPELL_EVERY_BARS = 8;
const SPELL_ORDER: readonly SpellKind[] = ["slow", "heart"];

/** Circle windows: an intense phrase start switches to circles ONLY, on every pattern hit, for 2–4 bars while the pattern stays strong. */
const CIRCLE_WINDOW_MIN_BARS = 2;
const CIRCLE_WINDOW_MAX_BARS = 4;
const CIRCLE_MIN_GAP_SLOTS = 2; // an eighth
/** A bar extends the window while its pattern hits keep this share of the first bar's strength. */
const CIRCLE_KEEP_REL = 0.75;
/** Songs this hard may open a window at EVERY intense phrase start (others only on 8-bar boundaries). */
const CIRCLE_EVERY_PHRASE_STARS = 6;
/** Lane bars between two windows — at most a third of the song is circles. */
const CIRCLE_COOLDOWN_BARS = 8;
/** Circles cycle through this many screen positions across the whole field. */
const CIRCLE_SPREAD = 8;

/** Lane-count sections: pools by [quiet, medium, intense]; decisions every 4 bars in energetic songs, else 8. */
const LANE_POOLS: readonly [
  readonly number[],
  readonly number[],
  readonly number[],
] = [
  [2, 3],
  [3, 4],
  [4, 5, 6],
];
const SECTION_BARS_CALM = 8;
const SECTION_BARS_ENERGETIC = 4;
const KEEP_LANES_CHANCE = 0.4;

export interface ComposeOptions {
  seed?: number;
  /** Let the lane count follow the music (2–6 lanes). Default on. */
  laneVariation?: boolean;
}

interface Bar {
  index: number;
  start: number; // slot index
  slots: Slot[];
  intensity: 0 | 1 | 2;
  lanes: number;
}

/** A 4-bar rhythm phrase and the figure the ear hears in it. */
export interface PhrasePattern {
  index: number;
  bars: Bar[];
  /** Per-step mean of boosted salience across the phrase's bars. */
  profile: number[];
  /** Pattern steps in placement priority order (loudest first). */
  steps: number[];
  accents: Set<number>;
  /** Max boosted salience of any slot in the phrase. */
  salMax: number;
  intense: boolean;
}

interface Event {
  si: number;
  bar: Bar;
  step: number;
  size: number; // chord size
  hold: number; // slots, 0 = tap
  kind: NoteKind | null;
  /** Roll taps. */
  taps: number;
  /** The "ТУ" of the figure: chord when a thumb is free, otherwise an outer lane. */
  accent: boolean;
}

/** Tiny deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 0..1 value for (seed, phrase, step, salt): the same decision for the same step in every bar of a phrase. */
function decide(
  seed: number,
  phrase: number,
  step: number,
  salt: number,
): number {
  let h = 2166136261 ^ seed;
  for (const p of [phrase, step, salt]) {
    h = Math.imul(h ^ (p | 0), 16777619);
    h ^= h >>> 13;
  }
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function groupBars(slots: readonly Slot[]): Bar[] {
  const bars: Bar[] = [];
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    let bar = bars[bars.length - 1];
    if (!bar || bar.index !== s.bar) {
      bar = {
        index: s.bar,
        start: i,
        slots: [],
        intensity: 1,
        lanes: LANE_COUNT,
      };
      bars.push(bar);
    }
    bar.slots.push(s);
  }
  return bars;
}

/**
 * Bar intensity (0 quiet / 1 medium / 2 intense) from the smoothed mean onset strength of the bar —
 * mostly "how many audible hits per bar". Quantiles over the track find the song's own loud and
 * quiet parts; absolute thresholds keep a wall-to-wall banger from being split into fake quiet
 * parts (a bar with sixteenths everywhere is intense whatever the rest of the song does), which is
 * also what makes such a song "energetic" (mean intensity ≥ 1.2).
 */
const INTENSE_ABS = 0.45;
const MEDIUM_ABS = 0.3;
export function rateIntensity(bars: Bar[]): void {
  const e = bars.map(
    (b) =>
      b.slots.reduce((acc, s) => acc + s.strength, 0) /
      Math.max(1, b.slots.length),
  );
  // Smooth within a phrase only: a chorus starting at bar 8 must not be dragged down by the intro.
  const sm = e.map((_, i) => {
    const prev = i % PHRASE_BARS === 0 ? e[i] : (e[i - 1] ?? e[i]);
    const next =
      i % PHRASE_BARS === PHRASE_BARS - 1 ? e[i] : (e[i + 1] ?? e[i]);
    return 0.25 * prev + 0.5 * e[i] + 0.25 * next;
  });
  const q35 = percentile(sm, 0.35);
  const q70 = percentile(sm, 0.7);
  for (let i = 0; i < bars.length; i++) {
    const v = sm[i];
    bars[i].intensity =
      v >= Math.min(Math.max(q70, MEDIUM_ABS), INTENSE_ABS)
        ? 2
        : v >= Math.min(Math.max(q35, 0.1), MEDIUM_ABS)
          ? 1
          : 0;
  }
}

/** Energetic songs (mean bar intensity ≥ 1.2) get denser charts and lane decisions every 4 bars. */
export function isEnergetic(bars: readonly Bar[]): boolean {
  if (!bars.length) return false;
  return (
    bars.reduce((a, b) => a + b.intensity, 0) / bars.length >=
    ENERGETIC_MEAN_INTENSITY
  );
}

/**
 * Lane count per section: quiet parts shrink to 2–3 lanes, medium parts play on 3–4, choruses
 * open up to 4–6. Decisions every 4 bars in energetic songs (else 8); the intro always starts on
 * 4 lanes; the previous count is kept with probability 0.4 when the new pool allows it — and always
 * after a bar listed in `keepAfter` (a bar ending in a drum fill: the fill and the pre-change silence
 * cannot share the same two beats).
 */
export function planSections(
  bars: Bar[],
  variation: boolean,
  random: () => number,
  energetic = isEnergetic(bars),
  keepAfter: ReadonlySet<number> = new Set(),
): SectionTuple[] {
  for (const b of bars) b.lanes = LANE_COUNT;
  const block = energetic ? SECTION_BARS_ENERGETIC : SECTION_BARS_CALM;
  if (!variation || bars.length < block * 2) return [[0, LANE_COUNT]];
  const sections: SectionTuple[] = [];
  let prevLanes = LANE_COUNT;
  for (let p = 0; p * block < bars.length; p++) {
    const phrase = bars.slice(p * block, (p + 1) * block);
    const intensity = Math.round(
      phrase.reduce((a, b) => a + b.intensity, 0) / phrase.length,
    ) as 0 | 1 | 2;
    let lanes: number;
    const pool = LANE_POOLS[intensity];
    if (p === 0) lanes = LANE_COUNT;
    else if (
      pool.includes(prevLanes) &&
      (keepAfter.has(p * block - 1) || random() < KEEP_LANES_CHANCE)
    )
      lanes = prevLanes;
    else {
      const fresh = pool.filter((n) => n !== prevLanes);
      const from = fresh.length ? fresh : pool;
      lanes = from[Math.floor(random() * from.length)];
    }
    lanes = Math.max(MIN_LANES, Math.min(MAX_LANES, lanes));
    for (const b of phrase) b.lanes = lanes;
    const time = round3(phrase[0].slots[0].time);
    if (!sections.length || sections[sections.length - 1][1] !== lanes)
      sections.push([sections.length ? time : 0, lanes]);
    prevLanes = lanes;
  }
  return sections;
}

/** How well a template fits the bar: reward notes on strong slots, punish notes on silence and missed hits. */
export function scoreTemplate(
  t: Template,
  strength: readonly number[],
  intensity: number,
  phraseEnd: boolean,
): number {
  let s = 0;
  for (let i = 0; i < STEPS_PER_BAR; i++) {
    const v = strength[i] ?? 0;
    if (t.mask[i] === "1") s += v - 0.4;
    else s -= 0.8 * Math.max(0, v - 0.5);
  }
  s += 0.03 * t.count * (intensity - 1);
  if (phraseEnd && t.category === "fill") s += 0.15;
  return s;
}

/** Grid preference: beats > eighths > sixteenths — breaks ties between equally loud steps the musical way. */
const gridBonus = (step: number): number =>
  (step % 4 === 0 ? 0.15 : step % 2 === 0 ? 0.05 : -0.12) +
  (step % 8 === 0 ? 0.03 : 0);

/**
 * Pattern steps of a phrase profile: local peaks (circular over the bar) reaching `PATTERN_REL` of
 * the max — plus, in intense phrases, steps next to a peak that are still very loud (sixteenth
 * pairs). Greedy by loudness with the min-gap rule, at most `cap` steps. Returned loudest first.
 */
export function patternSteps(
  profile: readonly number[],
  intense: boolean,
  cap: number,
): number[] {
  const n = profile.length;
  let max = 0;
  for (const v of profile) if (v > max) max = v;
  if (max < MIN_NOTE_STRENGTH) return [];
  const gap = intense ? MIN_GAP_INTENSE : MIN_GAP_SLOTS;
  const cand: { step: number; score: number }[] = [];
  for (let s = 0; s < n; s++) {
    const v = profile[s];
    if (v < PATTERN_REL * max) continue;
    const prev = profile[(s + n - 1) % n];
    const next = profile[(s + 1) % n];
    const peak = v >= prev && v >= next;
    if (!peak && !(intense && v >= PAIR_REL * max)) continue;
    cand.push({ step: s, score: v + gridBonus(s) });
  }
  cand.sort((a, b) => b.score - a.score || a.step - b.step);
  const chosen: number[] = [];
  for (const c of cand) {
    if (chosen.length >= cap) break;
    if (chosen.some((st) => Math.abs(st - c.step) < gap)) continue;
    chosen.push(c.step);
  }
  return chosen;
}

/**
 * Drum fill → roll: the bar ends with one or two beats where EVERY sixteenth sounds and the
 * off-sixteenths are clearly louder than in the rest of the bar (a fill, not a steady stream).
 * Phrase ends (bar 4/8/…) need less evidence — that is where fills live.
 */
function detectFill(
  bar: Bar,
  strength: readonly number[],
): { from: number; taps: number } | null {
  if (bar.intensity < 1) return null;
  const phraseEnd = bar.index % PHRASE_BARS === PHRASE_BARS - 1;
  let rollFrom = -1;
  let rollTaps = 0;
  const floor = phraseEnd ? ROLL_SLOT_SALIENCE * 0.75 : ROLL_SLOT_SALIENCE;
  const need = phraseEnd ? ROLL_MEAN_SALIENCE * 0.8 : ROLL_MEAN_SALIENCE;
  for (const len of [8, 4]) {
    const from = bar.slots.length - len;
    if (from < ROLL_MIN_TAPS) continue;
    let ok = true;
    let sum = 0;
    let offRun = 0;
    let offRunN = 0;
    for (let i = from; i < bar.slots.length; i++) {
      if (strength[i] < floor) ok = false;
      sum += strength[i];
      if (i % 2 === 1) {
        offRun += strength[i];
        offRunN++;
      }
    }
    if (!ok || sum / len < need) continue;
    let offRest = 0;
    let offRestN = 0;
    for (let i = 1; i < from; i += 2) {
      offRest += strength[i];
      offRestN++;
    }
    const contrast =
      offRun /
      Math.max(1, offRunN) /
      Math.max(0.06, offRest / Math.max(1, offRestN));
    if (contrast >= ROLL_CONTRAST) {
      rollFrom = from;
      rollTaps = Math.min(ROLL_MAX_TAPS, len);
      break;
    }
  }
  return rollFrom >= 0 ? { from: rollFrom, taps: rollTaps } : null;
}

/** Keep at most `limit(bar)` distinct note times in any 1-second window, dropping the least salient extras. */
function capDensity(
  events: Event[],
  slots: readonly Slot[],
  limit: (bar: Bar) => number,
): Event[] {
  const kept: Event[] = [];
  const weight = (e: Event) =>
    salience(slots[e.si]) +
    (e.step % 4 === 0 ? 0.3 : 0) +
    (e.accent ? 0.2 : 0) +
    (e.kind ? 1 : 0);
  for (const ev of events) {
    kept.push(ev);
    const t = slots[ev.si].time;
    const window = kept.filter((e) => slots[e.si].time > t - 1);
    if (window.length <= limit(ev.bar)) continue;
    let weakest = window[0];
    for (const e of window) if (weight(e) < weight(weakest)) weakest = e;
    kept.splice(kept.indexOf(weakest), 1);
  }
  return kept;
}

export function composeChart(
  analysis: SongAnalysis,
  opts: ComposeOptions = {},
): ChartLevel {
  const seed = opts.seed ?? 1337;
  const random = rng(seed);
  const slots = analysis.slots;
  if (slots.length < STEPS_PER_BAR)
    return { stars: 1, notes: [], sections: [[0, LANE_COUNT]] };

  const bars = groupBars(slots);
  rateIntensity(bars);
  const energetic = isEnergetic(bars);
  // Quiet phrases (intros, breakdowns) are boosted so their own peaks still get sparse notes;
  // true silence stays empty thanks to the absolute floor below.
  const phrasesRaw: Bar[][] = [];
  for (let p = 0; p * PHRASE_BARS < bars.length; p++)
    phrasesRaw.push(bars.slice(p * PHRASE_BARS, (p + 1) * PHRASE_BARS));
  const boost = new Map<number, number>();
  for (const phrase of phrasesRaw) {
    const peak = percentile(
      phrase.flatMap((b) => b.slots.map(salience)),
      0.9,
    );
    const factor =
      peak >= MIN_RAW_STRENGTH
        ? Math.min(MAX_BOOST, Math.max(1, BOOST_TARGET / peak))
        : 1;
    for (const b of phrase) boost.set(b.index, factor);
  }
  const sal = slots.map((s) =>
    Math.min(1, salience(s) * (boost.get(s.bar) ?? 1)),
  );
  // Drum fills are found before the lane plan: a lane change needs two beats of silence, and a
  // fill lives exactly there — so the plan keeps the lane count across a boundary that ends in a fill.
  const fills = new Map<number, { from: number; taps: number }>();
  for (const bar of bars) {
    const f = detectFill(
      bar,
      bar.slots.map((_s, k) => sal[bar.start + k]),
    );
    if (f) fills.set(bar.index, f);
  }
  const sections = planSections(
    bars,
    opts.laneVariation ?? true,
    random,
    energetic,
    new Set(fills.keys()),
  );
  const densityLimit = (bar: Bar): number =>
    bar.intensity === 2 && energetic
      ? DENSITY_LIMIT
      : DENSITY_BY_INTENSITY[bar.intensity];
  const barSeconds = (bar: Bar): number =>
    slots[Math.min(slots.length - 1, bar.start + bar.slots.length)].time -
    slots[bar.start].time;
  const barCap = (bar: Bar): number =>
    Math.max(
      1,
      Math.min(
        MAX_NOTES[bar.intensity],
        MAX_NOTES_BY_LANES[bar.lanes] ?? 16,
        Math.floor(densityLimit(bar) * Math.max(0.5, barSeconds(bar))),
      ),
    );

  // 1. The rhythm profile of every 4-bar phrase → pattern steps (the figure) and accents.
  const phrases: PhrasePattern[] = phrasesRaw.map((phraseBars, index) => {
    const profile = new Array<number>(STEPS_PER_BAR).fill(0);
    const counts = new Array<number>(STEPS_PER_BAR).fill(0);
    let salMax = 0;
    for (const b of phraseBars) {
      for (let k = 0; k < b.slots.length && k < STEPS_PER_BAR; k++) {
        const v = sal[b.start + k];
        profile[k] += v;
        counts[k]++;
        if (v > salMax) salMax = v;
      }
    }
    for (let k = 0; k < STEPS_PER_BAR; k++)
      profile[k] = counts[k] ? profile[k] / counts[k] : 0;
    const intense =
      phraseBars.reduce((a, b) => a + b.intensity, 0) / phraseBars.length >=
      1.5;
    const cap = Math.max(...phraseBars.map(barCap));
    const steps = patternSteps(profile, intense, cap);
    const pmax = Math.max(...profile);
    const accents = new Set(
      steps.filter((s) => profile[s] >= ACCENT_REL * pmax),
    );
    return {
      index,
      bars: phraseBars,
      profile,
      steps,
      accents,
      salMax,
      intense,
    };
  });
  const phraseOf = (bar: Bar): PhrasePattern =>
    phrases[Math.floor(bar.index / PHRASE_BARS)] ?? phrases[phrases.length - 1];
  /** Does this bar sound the phrase's pattern step? (Its own hit must be there, not just the phrase average.) */
  const sounds = (phrase: PhrasePattern, bar: Bar, step: number): boolean => {
    if (step >= bar.slots.length) return false;
    const gi = bar.start + step;
    return (
      bar.slots[step].strength >= MIN_RAW_STRENGTH &&
      sal[gi] >= Math.max(MIN_NOTE_STRENGTH, SOUND_REL * phrase.profile[step])
    );
  };

  // 1a. Notes: every bar repeats the phrase figure where it sounds, plus very strong off-pattern hits.
  //     Drum fills and phrase-end streams become rolls.
  const events: Event[] = [];
  let lastRollBar = -10;
  for (const bar of bars) {
    const phrase = phraseOf(bar);
    const cap = barCap(bar);
    const strength = bar.slots.map((_s, k) => sal[bar.start + k]);
    const phraseEnd = bar.index % PHRASE_BARS === PHRASE_BARS - 1;
    const gap = bar.intensity === 2 ? MIN_GAP_INTENSE : MIN_GAP_SLOTS;
    let rollFrom = -1;
    let rollTaps = 0;
    const fill = fills.get(bar.index);
    if (fill) {
      rollFrom = fill.from;
      rollTaps = fill.taps;
    }
    // Stream → roll: the last bar of an intense phrase whose figure has four audible eighths on the
    // second half ends in "drum it" — the same four hits, in one lane as a Taiko-style roll. Always
    // on the phrase end, so the 4-bar figure reads as three bars of pattern + one turnaround.
    if (
      rollFrom < 0 &&
      phraseEnd &&
      bar.intensity === 2 &&
      bar.index - lastRollBar >= ROLL_COOLDOWN_BARS &&
      [8, 10, 12, 14].every(
        (i) =>
          phrase.steps.includes(i) && strength[i] >= ROLL_STREAM_MIN_STRENGTH,
      )
    ) {
      rollFrom = 8;
      rollTaps = 4;
    }
    if (rollFrom >= 0) {
      // Physical limit: taps per second. At 200+ BPM a one-beat fill is too short to roll — keep the taps.
      const endIdx = Math.min(slots.length - 1, bar.start + bar.slots.length);
      const dur = slots[endIdx].time - bar.slots[rollFrom].time;
      rollTaps = Math.min(rollTaps, Math.floor(dur * ROLL_MAX_TAPS_PER_SEC));
      if (rollTaps < ROLL_MIN_TAPS) rollFrom = -1;
    }
    if (rollFrom >= 0) lastRollBar = bar.index;

    const placed: number[] = [];
    const fits = (step: number) =>
      !placed.some((st) => Math.abs(st - step) < gap);
    for (const step of phrase.steps) {
      if (placed.length >= cap) break;
      if (rollFrom >= 0 && step >= rollFrom) continue;
      if (!sounds(phrase, bar, step) || !fits(step)) continue;
      placed.push(step);
    }
    // Extras: off-pattern hits only when very strong (fills, stabs) and a clear local peak of this bar.
    const extras: { step: number; score: number }[] = [];
    for (let step = 0; step < bar.slots.length; step++) {
      if (rollFrom >= 0 && step >= rollFrom) continue;
      if (phrase.steps.includes(step)) continue;
      const gi = bar.start + step;
      const v = sal[gi];
      if (
        v < EXTRA_REL * phrase.salMax ||
        bar.slots[step].strength < MIN_RAW_STRENGTH
      )
        continue;
      if (v < (sal[gi - 1] ?? 0) || v < (sal[gi + 1] ?? 0)) continue;
      extras.push({ step, score: v + gridBonus(step) });
    }
    extras.sort((a, b) => b.score - a.score || a.step - b.step);
    for (const e of extras) {
      if (placed.length >= cap) break;
      if (fits(e.step)) placed.push(e.step);
    }
    placed.sort((a, b) => a - b);
    for (const step of placed)
      events.push({
        si: bar.start + step,
        bar,
        step,
        size: 1,
        hold: 0,
        kind: null,
        taps: 0,
        accent: phrase.accents.has(step),
      });
    if (rollFrom >= 0 && rollFrom < bar.slots.length) {
      const len = bar.slots.length - rollFrom;
      events.push({
        si: bar.start + rollFrom,
        bar,
        step: rollFrom,
        size: 1,
        hold: len,
        kind: "roll",
        taps: Math.max(ROLL_MIN_TAPS, Math.min(rollTaps, len)),
        accent: false,
      });
    }
  }

  // 1b. Breathing room before every lane-count change, and the rolling per-second cap.
  const lastBarOfSection = new Set<number>();
  for (let i = 0; i + 1 < bars.length; i++)
    if (bars[i + 1].lanes !== bars[i].lanes)
      lastBarOfSection.add(bars[i].index);
  let filtered = events.filter(
    (ev) =>
      !(
        lastBarOfSection.has(ev.bar.index) &&
        ev.step >= STEPS_PER_BAR - SECTION_GAP_SLOTS
      ),
  );
  filtered = capDensity(filtered, slots, densityLimit);
  events.length = 0;
  events.push(...filtered);

  // 1c. Circle windows: when an intense phrase (chorus / drop) starts, its first bars switch to
  // osu!-style hit circles ONLY — lane notes are cleared there (plus one beat before) — and a
  // circle sits on EVERY pattern hit of the window, so the figure keeps going as circles. The
  // window lasts 2–4 bars while the pattern stays strong. Hard songs may open one at every
  // intense phrase start; easier ones only on 8-bar boundaries. Modes never mix.
  const provisional = rateStars(
    eventsToTuples(events, slots),
    analysis.bpm,
    sections,
  );
  const everyPhrase = provisional >= CIRCLE_EVERY_PHRASE_STARS;
  const patternStrength = (phrase: PhrasePattern, bar: Bar): number => {
    let sum = 0;
    for (const s of phrase.steps)
      if (s < bar.slots.length) sum += sal[bar.start + s];
    return sum;
  };
  let lastWindowEnd = -100;
  for (const bar of bars) {
    if (bar.index % PHRASE_BARS !== 0 || bar.intensity !== 2 || bar.index < 4)
      continue;
    if (!everyPhrase && bar.index % (PHRASE_BARS * 2) !== 0) continue;
    if (bar.index < lastWindowEnd + CIRCLE_COOLDOWN_BARS) continue;
    const phrase = phraseOf(bar);
    if (!phrase.steps.length) continue;
    const head = patternStrength(phrase, bar);
    if (head <= 0) continue;
    const windowBars: Bar[] = [];
    for (let k = 0; k < CIRCLE_WINDOW_MAX_BARS && k < phrase.bars.length; k++) {
      const wb = phrase.bars[k];
      if (
        k >= CIRCLE_WINDOW_MIN_BARS &&
        (wb.intensity !== 2 ||
          patternStrength(phrase, wb) < CIRCLE_KEEP_REL * head)
      )
        break;
      windowBars.push(wb);
    }
    if (windowBars.length < CIRCLE_WINDOW_MIN_BARS) continue;
    const startSi = bar.start;
    const last = windowBars[windowBars.length - 1];
    const endSi = last.start + last.slots.length;
    lastWindowEnd = last.index + 1;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.si >= startSi - 4 && e.si < endSi) events.splice(i, 1);
      else if (
        e.hold > 0 &&
        e.si < startSi - 4 &&
        e.si + e.hold > startSi - 4
      ) {
        e.hold = Math.max(2, startSi - 4 - e.si);
        if (e.kind === "roll") {
          // A shortened roll must not become a tap-rate impossibility: fewer taps, or a plain tap.
          const dur =
            slots[Math.min(slots.length - 1, e.si + e.hold)].time -
            slots[e.si].time;
          e.taps = Math.min(e.taps, Math.floor(dur * ROLL_MAX_TAPS_PER_SEC));
          if (e.taps < ROLL_MIN_TAPS) {
            e.kind = null;
            e.hold = 0;
            e.taps = 0;
          }
        }
      }
    }
    const hits: { si: number; bar: Bar; score: number }[] = [];
    for (const wb of windowBars) {
      // The two-beat silence before a lane-count change holds for circles too.
      const gapFrom = lastBarOfSection.has(wb.index)
        ? STEPS_PER_BAR - SECTION_GAP_SLOTS
        : Infinity;
      for (const step of phrase.steps) {
        if (step >= gapFrom || !sounds(phrase, wb, step)) continue;
        hits.push({
          si: wb.start + step,
          bar: wb,
          score: sal[wb.start + step] + gridBonus(step),
        });
      }
    }
    hits.sort((a, b) => b.score - a.score || a.si - b.si);
    const chosen: { si: number; bar: Bar }[] = [];
    for (const h of hits) {
      if (chosen.some((c) => Math.abs(c.si - h.si) < CIRCLE_MIN_GAP_SLOTS))
        continue;
      chosen.push(h);
    }
    for (const c of chosen)
      events.push({
        si: c.si,
        bar: c.bar,
        step: c.si - c.bar.start,
        size: 1,
        hold: 0,
        kind: "circle",
        taps: 0,
        accent: false,
      });
  }
  events.sort((a, b) => a.si - b.si);
  filtered = capDensity(events, slots, densityLimit);
  events.length = 0;
  events.push(...filtered);

  // 1d. Spell notes: the first plain lane note of every 8th bar (from bar 4) alternates slow / heart.
  let spellCount = 0;
  for (let b = 4; b < bars.length; b += SPELL_EVERY_BARS) {
    const ev =
      events.find((e) => e.bar.index === b && !e.kind && !e.hold) ??
      events.find((e) => e.bar.index === b + 1 && !e.kind && !e.hold);
    if (!ev) continue;
    ev.kind = SPELL_ORDER[spellCount++ % SPELL_ORDER.length];
  }

  // 2. Holds on sustained melodic sounds (some become slides), chords on accents — under the
  //    two-finger rule. Hold / slide / bass-roll decisions are taken per (phrase, step), so the
  //    same step of the figure gets the same treatment in every bar of the phrase.
  const holdBudget = new Map<number, number>();
  const activeHoldEnds: number[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const slot = slots[ev.si];
    const gapNext = i + 1 < events.length ? events[i + 1].si - ev.si : Infinity;
    const gapPrev = i > 0 ? ev.si - events[i - 1].si : Infinity;
    const intensity = ev.bar.intensity;
    const phraseIdx = Math.floor(ev.bar.index / PHRASE_BARS);

    while (activeHoldEnds.length && activeHoldEnds[0] <= ev.si)
      activeHoldEnds.shift();
    if (ev.kind === "roll") {
      if (activeHoldEnds.length) {
        ev.kind = null;
        ev.hold = 0;
        ev.taps = 0;
      } else {
        activeHoldEnds.push(ev.si + ev.hold);
        activeHoldEnds.sort((a, b) => a - b);
      }
      continue;
    }
    if (ev.kind) continue; // spells and circles stay plain taps
    const budget = holdBudget.get(ev.bar.index) ?? HOLD_BUDGET;
    const melodic = slot.low < 0.55;
    const bassLen = Math.min(slot.sustain, gapNext, 8);
    const bassDur =
      slots[Math.min(slots.length - 1, ev.si + bassLen)].time - slot.time;
    const bassTaps = Math.min(
      ROLL_MAX_TAPS,
      Math.round(bassLen / 2) + 1,
      Math.floor(bassDur * ROLL_MAX_TAPS_PER_SEC),
    );
    if (
      slot.sustain >= 4 &&
      !melodic &&
      intensity >= 1 &&
      budget > 0 &&
      !activeHoldEnds.length &&
      gapNext >= 4 &&
      bassTaps >= ROLL_MIN_TAPS &&
      decide(seed, phraseIdx, ev.step, 1) < ROLL_ON_BASS_CHANCE
    ) {
      const len = bassLen;
      ev.kind = "roll";
      ev.hold = len;
      ev.taps = bassTaps;
      ev.size = 1;
      holdBudget.set(ev.bar.index, budget - 1);
      activeHoldEnds.push(ev.si + len);
      activeHoldEnds.sort((a, b) => a - b);
      continue;
    }
    if (
      slot.sustain >= 2 &&
      melodic &&
      budget > 0 &&
      activeHoldEnds.length < MAX_ACTIVE_HOLDS &&
      decide(seed, phraseIdx, ev.step, 2) < HOLD_CHANCE[intensity]
    ) {
      let dur = Math.min(slot.sustain, MAX_HOLD_SLOTS);
      const barEnd = ev.bar.start + ev.bar.slots.length;
      if (lastBarOfSection.has(ev.bar.index))
        dur = Math.min(dur, barEnd - SECTION_GAP_SLOTS - ev.si);
      else if (lastBarOfSection.has(ev.bar.index + 1))
        dur = Math.min(dur, barEnd + STEPS_PER_BAR - SECTION_GAP_SLOTS - ev.si);
      if (dur >= 2) {
        ev.hold = dur;
        ev.size = 1;
        if (
          dur >= 4 &&
          intensity >= 1 &&
          ev.bar.lanes >= 3 &&
          decide(seed, phraseIdx, ev.step, 3) < SLIDE_CHANCE
        )
          ev.kind = "slide";
        holdBudget.set(ev.bar.index, budget - 1);
        activeHoldEnds.push(ev.si + dur);
        activeHoldEnds.sort((a, b) => a - b);
        continue;
      }
    }

    if (activeHoldEnds.length) continue; // two-finger rule: one thumb is busy → an accent lands in an outer lane instead
    const inStream = gapPrev <= 1 || gapNext <= 1;
    if (!ev.accent || inStream || ev.bar.lanes < 2) continue;
    ev.size = MAX_CHORD;
  }

  // 2a. Nothing else while a slide is in progress — a moving thumb cannot tap.
  const slideSpans = events
    .filter((e) => e.kind === "slide")
    .map((e) => [e.si, e.si + e.hold] as const);
  const playable = events.filter(
    (e) =>
      e.kind === "slide" || !slideSpans.some(([a, b]) => e.si > a && e.si < b),
  );

  // 3. Lanes.
  const notes = assignLanes(playable, slots, random);
  return { stars: rateStars(notes, analysis.bpm, sections), notes, sections };
}

/** Lane-less tuples of the current events — enough for a provisional difficulty rating. */
function eventsToTuples(
  events: readonly Event[],
  slots: readonly Slot[],
): NoteTuple[] {
  const out: NoteTuple[] = [];
  for (const e of events) {
    const time = round3(slots[e.si].time);
    const dur =
      e.hold > 0
        ? round3(
            slots[Math.min(slots.length - 1, e.si + e.hold)].time -
              slots[e.si].time,
          )
        : 0;
    for (let k = 0; k < e.size; k++) {
      if (e.kind === "roll") out.push([time, k, dur, "roll", e.taps]);
      else if (e.kind === "slide") out.push([time, k, dur, "slide", k + 1]);
      else if (e.kind) out.push([time, k, 0, e.kind]);
      else if (dur > 0) out.push([time, k, dur]);
      else out.push([time, k]);
    }
  }
  return out;
}

type MotionKind = "up" | "down" | "zigzag" | "trill";

class Motion {
  private seq: number[];
  private pos = 0;
  constructor(kind: MotionKind, n: number, random: () => number) {
    const up = Array.from({ length: n }, (_, i) => i);
    switch (kind) {
      case "up":
        this.seq = up;
        break;
      case "down":
        this.seq = [...up].reverse();
        break;
      case "zigzag": {
        const z = [
          ...up.filter((l) => l % 2 === 0),
          ...up.filter((l) => l % 2 === 1),
        ];
        this.seq = random() < 0.5 ? z : z.reverse();
        break;
      }
      case "trill": {
        const left = up.filter((l) => l < n / 2);
        const right = up.filter((l) => l >= n / 2);
        this.seq = [
          left[Math.floor(random() * left.length)],
          right[Math.floor(random() * right.length)],
        ];
        break;
      }
    }
  }

  next(candidates: readonly number[]): number {
    for (let tries = 0; tries < this.seq.length; tries++) {
      const lane = this.seq[(this.pos + tries) % this.seq.length];
      if (candidates.includes(lane)) {
        this.pos = (this.pos + tries + 1) % this.seq.length;
        return lane;
      }
    }
    return candidates[0];
  }
}

/** Preferred chord shapes for `n` lanes: outer pair on downbeats, inner pair otherwise, then anything. */
function chordPairs(n: number, down: boolean): number[][] {
  const outer = [0, n - 1];
  const m = Math.floor(n / 2);
  const inner = n % 2 === 0 ? [m - 1, m] : [m - 1, m + 1];
  const pairs = down ? [outer, inner] : [inner, outer];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  return pairs.filter((p) => p[0] !== p[1] && p[0] >= 0 && p[1] < n);
}

/** Lanes whose centre falls in the band's third of the playfield (thirds overlap so none is empty). */
function bandLanes(n: number, band: 0 | 1 | 2): number[] {
  const out: number[] = [];
  for (let l = 0; l < n; l++) {
    const c = (l + 0.5) / n;
    if (
      (band === 0 && c < 0.4) ||
      (band === 1 && c > 0.25 && c < 0.75) ||
      (band === 2 && c > 0.6)
    )
      out.push(l);
  }
  return out.length
    ? out
    : [band === 0 ? 0 : band === 2 ? n - 1 : Math.floor(n / 2)];
}

/**
 * Screen positions for a run of circles on `n` lanes: an 8-point cycle across the whole field
 * (left, right, centre, …) whose consecutive entries never share a lane; combined with the
 * renderer's three heights no two consecutive circles sit at the same spot.
 */
export function circleSpread(n: number): number[] {
  const order = [
    0,
    n - 1,
    Math.floor(n / 2),
    1,
    n - 2,
    Math.ceil(n / 2) - 1,
    Math.floor(n / 2) + 1,
    n - 3,
  ].filter((l) => l >= 0 && l < n);
  const out: number[] = [];
  let i = 0;
  while (out.length < CIRCLE_SPREAD) {
    const lane = order[i % order.length];
    i++;
    if (n > 1 && out.length && out[out.length - 1] === lane) continue;
    if (n > 1 && out.length === CIRCLE_SPREAD - 1 && lane === out[0]) continue;
    out.push(lane);
  }
  return out;
}

function assignLanes(
  events: readonly Event[],
  slots: readonly Slot[],
  random: () => number,
): NoteTuple[] {
  const notes: NoteTuple[] = [];
  const heldUntil = new Array<number>(8).fill(-1);
  /** Consecutive events that used each lane — the "≤ 2 in a row per lane" rule. */
  const laneRun = new Array<number>(8).fill(0);
  let lastLane = -1;
  let lastSi = -100;
  let lastSide = 1;
  let motion: Motion | null = null;
  let motionBar = -1;
  let lastLanes = -1;
  let circleIdx = -1;
  let circleOffset = 0;
  let lastCircleSi = -100;
  let accentSide = 0;

  for (const ev of events) {
    const slot = slots[ev.si];
    const n = ev.bar.lanes;
    if (n !== lastLanes) {
      heldUntil.fill(-1);
      lastLanes = n;
    }
    const free: number[] = [];
    for (let l = 0; l < n; l++) if (heldUntil[l] < ev.si) free.push(l);
    if (!free.length) continue;
    const gap = ev.si - lastSi;

    if (ev.bar.index !== motionBar) {
      motionBar = ev.bar.index;
      const kinds: MotionKind[] = ["up", "down", "zigzag", "trill"];
      motion = new Motion(
        kinds[Math.floor(random() * kinds.length)],
        n,
        random,
      );
    }

    let candidates = free.filter((l) => laneRun[l] < 2);
    if (!candidates.length) candidates = free;

    let lanes: number[];
    if (ev.size >= 2) {
      const pair = chordPairs(n, ev.step === 0).find((p) =>
        p.every((l) => candidates.includes(l)),
      );
      lanes = pair
        ? [...pair]
        : [candidates[Math.floor(random() * candidates.length)]];
    } else if (ev.kind === "circle") {
      // Circles cycle across the whole field so a group reads as a path: left, right, centre, …
      const spread = circleSpread(n);
      if (ev.si - lastCircleSi > 24) {
        // New group: start the path on a lane the player has not just been hammering.
        circleIdx = 0;
        circleOffset = Math.max(
          0,
          spread.findIndex((l) => laneRun[l] < 2),
        );
      } else circleIdx++;
      lastCircleSi = ev.si;
      lanes = [spread[(circleOffset + circleIdx) % spread.length]];
    } else if (ev.accent && ev.hold === 0 && !ev.kind && gap > 1) {
      // An accent that could not be a chord (a thumb is busy) lands in an outer lane, alternating sides.
      const outer = [0, n - 1].filter((l) => candidates.includes(l));
      if (outer.length) {
        accentSide = 1 - accentSide;
        lanes = [outer.length === 2 ? outer[accentSide] : outer[0]];
      } else lanes = [candidates[Math.floor(random() * candidates.length)]];
    } else {
      let lane: number;
      if (gap <= 1 && motion) {
        lane = motion.next(candidates);
      } else if (gap === 2) {
        const side = 1 - lastSide;
        const onSide = candidates.filter(
          (l) => ((l + 0.5) / n < 0.5 ? 0 : 1) === side,
        );
        const pool = onSide.length ? onSide : candidates;
        const band: 0 | 1 | 2 =
          slot.low >= slot.mid && slot.low >= slot.high
            ? 0
            : slot.high > slot.mid
              ? 2
              : 1;
        const preferred = pool.filter((l) => bandLanes(n, band).includes(l));
        const from = preferred.length ? preferred : pool;
        lane = from[Math.floor(random() * from.length)];
      } else {
        const band: 0 | 1 | 2 =
          slot.low >= slot.mid && slot.low >= slot.high
            ? 0
            : slot.high > slot.mid
              ? 2
              : 1;
        const group = bandLanes(n, band);
        let pool = candidates.filter((l) => group.includes(l));
        if (!pool.length) pool = candidates;
        const fresh = pool.filter((l) => l !== lastLane);
        const choose = fresh.length && random() < 0.8 ? fresh : pool;
        lane = choose[Math.floor(random() * choose.length)];
      }
      lanes = [lane];
    }

    const time = round3(slot.time);
    for (const lane of lanes) {
      if (ev.hold > 0) {
        const endIdx = Math.min(slots.length - 1, ev.si + ev.hold);
        const dur = round3(slots[endIdx].time - slot.time);
        if (ev.kind === "roll") {
          notes.push([time, lane, dur, "roll", ev.taps]);
          heldUntil[lane] = endIdx;
        } else if (ev.kind === "slide") {
          // Slide into the free lane next door (never across a lane); both lanes are blocked for the duration.
          const options = [lane + 1, lane - 1].filter(
            (l) => l >= 0 && l < n && heldUntil[l] < ev.si,
          );
          if (options.length) {
            const end =
              options[Math.floor(random() * Math.min(2, options.length))];
            notes.push([time, lane, dur, "slide", end]);
            heldUntil[lane] = endIdx;
            heldUntil[end] = endIdx;
          } else {
            notes.push([time, lane, dur]);
            heldUntil[lane] = endIdx;
          }
        } else {
          notes.push([time, lane, dur]);
          heldUntil[lane] = endIdx;
        }
      } else if (ev.kind) notes.push([time, lane, 0, ev.kind]);
      else notes.push([time, lane]);
    }
    for (let l = 0; l < 8; l++)
      laneRun[l] = lanes.includes(l) ? laneRun[l] + 1 : 0;
    const primary = lanes[lanes.length - 1];
    lastLane = primary;
    lastSide = (primary + 0.5) / n < 0.5 ? 0 : 1;
    lastSi = ev.si;
  }

  notes.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return notes;
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Star-rating weights: felt difficulty = density first, then speed of hands, width of the field, mechanics, tempo. */
const STAR_W = {
  nps: 2.2,
  sixteenths: 2.0,
  peak: 0.45,
  wide: 1.2,
  special: 2.5,
  chords: 1.5,
  tempo: 1.0,
  offset: -0.9,
} as const;

/**
 * Difficulty rating 1–10 = felt difficulty: notes per second (dominant), share of sixteenth gaps,
 * peak 2-second density above the average, share of the song played on ≥ 5 lanes, share of
 * slides / rolls / circles, chord share and tempo. Calibrated so the easiest catalog track is
 * ★2–3 and the hardest ★8–9.
 */
export function rateStars(
  notes: readonly NoteTuple[],
  bpm = 120,
  sections?: readonly SectionTuple[],
): number {
  if (notes.length < 2) return 1;
  const f = starFeatures(notes, bpm, sections);
  const raw =
    f.nps * STAR_W.nps +
    f.share16 * STAR_W.sixteenths +
    Math.max(0, f.peak - f.nps) * STAR_W.peak +
    f.wide * STAR_W.wide +
    f.special * STAR_W.special +
    f.chords * STAR_W.chords +
    f.tempo * STAR_W.tempo +
    STAR_W.offset;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

/** The measurable ingredients of felt difficulty (see `rateStars`). */
export interface StarFeatures {
  /** Notes per second over the charted span. */
  nps: number;
  /** Share of gaps between note times that are a sixteenth (or less). */
  share16: number;
  /** Densest 2-second window, in notes per second. */
  peak: number;
  /** Share of the charted span played on ≥ 5 lanes. */
  wide: number;
  /** Share of slides, rolls and circles. */
  special: number;
  /** Share of notes that are the second voice of a chord. */
  chords: number;
  /** Tempo 100–180 BPM mapped to 0..1. */
  tempo: number;
}

export function starFeatures(
  notes: readonly NoteTuple[],
  bpm = 120,
  sections?: readonly SectionTuple[],
): StarFeatures {
  const times = [...new Set(notes.map((n) => n[0]))].sort((a, b) => a - b);
  if (times.length < 2)
    return {
      nps: 0,
      share16: 0,
      peak: 0,
      wide: 0,
      special: 0,
      chords: 0,
      tempo: 0,
    };
  const span = Math.max(1, times[times.length - 1] - times[0]);
  const avgNps = notes.length / span;
  const sixteenth = 15 / Math.max(60, bpm);
  let fast = 0;
  for (let i = 1; i < times.length; i++)
    if (times[i] - times[i - 1] <= sixteenth * 1.25) fast++;
  const share16 = times.length > 1 ? fast / (times.length - 1) : 0;
  let peak = 0;
  let j = 0;
  for (let i = 0; i < times.length; i++) {
    while (times[i] - times[j] > 2) j++;
    peak = Math.max(peak, (i - j + 1) / 2);
  }
  let wide = 0;
  if (sections && sections.length) {
    const first = times[0];
    const last = times[times.length - 1];
    for (let i = 0; i < sections.length; i++) {
      const from = Math.max(first, sections[i][0]);
      const to = Math.min(
        last,
        i + 1 < sections.length ? sections[i + 1][0] : last,
      );
      if (sections[i][1] >= 5 && to > from) wide += to - from;
    }
    wide /= span;
  }
  const special =
    notes.filter(
      (n) => n[3] === "slide" || n[3] === "roll" || n[3] === "circle",
    ).length / notes.length;
  const chords = (notes.length - times.length) / notes.length;
  const tempo = Math.max(0, Math.min(1, (bpm - 100) / 80));
  return { nps: avgNps, share16, peak, wide, special, chords, tempo };
}

/** Mechanic counts for the song card. */
export function chartFeatures(level: ChartLevel): {
  circles: number;
  rolls: number;
  slides: number;
  holds: number;
  laneChanges: number;
} {
  const kind = (k: NoteKind) => level.notes.filter((n) => n[3] === k).length;
  return {
    circles: kind("circle"),
    rolls: kind("roll"),
    slides: kind("slide"),
    holds: level.notes.filter((n) => n.length === 3 && (n[2] as number) > 0)
      .length,
    laneChanges: Math.max(0, (level.sections?.length ?? 1) - 1),
  };
}
