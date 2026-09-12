import { DENSITY_LIMIT, LANE_COUNT } from '@/shared/config/constants';
import { percentile } from '@/shared/lib/math';
import type { ChartLevel, SpellKind } from '@/shared/types/chart';
import { STEPS_PER_BAR, type Slot, type SongAnalysis } from './SongAnalyzer';
import { PHRASE_BARS, decide, groupBars, isEnergetic, rateIntensity, rng, salience, type Bar, type Event } from './bars';
import { assignLanes } from './laneAssign';
import { EASY_LANE_POOLS, LANE_POOLS, planSections } from './lanePlan';
import {
  ACCENT_REL,
  EXTRA_REL,
  MIN_GAP_INTENSE,
  MIN_GAP_SLOTS,
  MIN_NOTE_STRENGTH,
  MIN_RAW_STRENGTH,
  ROLL_MAX_TAPS,
  ROLL_MIN_TAPS,
  SOUND_REL,
  detectFill,
  gridBonus,
  patternSteps,
  type PhrasePattern,
} from './phrasePattern';
import { eventsToTuples, rateStars } from './stars';

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

/**
 * Difficulty profile. `normal` is the song as it is; `easy` is the beginner reading of the same
 * song for the first chapter: beats only (a beat between notes), a few notes per bar, no rolls,
 * slides, chords or sixteenths, holds no longer than a bar, sparse circles, 3–4 lanes.
 */
export interface Profile {
  /** Max notes per bar by intensity [quiet, medium, intense]. */
  maxNotes: readonly [number, number, number];
  /** Fewer lanes → fewer notes per bar. */
  maxNotesByLanes: Record<number, number>;
  /** Rolling 1-second cap by bar intensity; intense bars of energetic songs go up to `densityPeak`. */
  density: readonly [number, number, number];
  densityPeak: number;
  /** Min slots between plain notes; null = the phrase rule (a sixteenth in intense bars, an eighth elsewhere). */
  gap: number | null;
  rolls: boolean;
  slides: boolean;
  chords: boolean;
  extras: boolean;
  maxHoldSlots: number;
  circleGapSlots: number;
  circlesPerWindow: number;
  lanePools: typeof LANE_POOLS;
  keepLanesChance: number;
  /** Which spells the chart may carry: the slow-motion spell is a tool for hard songs, not a beginner's first surprise. */
  spells: readonly SpellKind[];
}

export const NORMAL: Profile = {
  maxNotes: [3, 6, 9],
  maxNotesByLanes: { 2: 4, 3: 6 },
  density: [3, 4, 4.5],
  densityPeak: DENSITY_LIMIT,
  gap: null,
  rolls: true,
  slides: true,
  chords: true,
  extras: true,
  maxHoldSlots: 16,
  circleGapSlots: 2,
  circlesPerWindow: Infinity,
  lanePools: LANE_POOLS,
  keepLanesChance: 0.4,
  spells: ['slow', 'heart'],
};

/** Chapter two: eighths allowed, a few holds and slides, still no rolls or chords, up to five lanes. */
export const MEDIUM: Profile = {
  maxNotes: [3, 5, 7],
  maxNotesByLanes: { 2: 3, 3: 5 },
  density: [2.5, 3, 3.5],
  densityPeak: 3.5,
  gap: 2,
  rolls: false,
  slides: true,
  chords: false,
  extras: false,
  maxHoldSlots: 16,
  circleGapSlots: 4,
  circlesPerWindow: 6,
  lanePools: [[3], [3, 4], [4, 5]],
  keepLanesChance: 0.6,
  spells: ['heart'],
};

export const EASY: Profile = {
  maxNotes: [2, 3, 4],
  maxNotesByLanes: { 2: 2, 3: 3 },
  density: [1.5, 2, 2],
  densityPeak: 2,
  gap: 4,
  rolls: false,
  slides: false,
  chords: false,
  extras: false,
  maxHoldSlots: 16,
  circleGapSlots: 4,
  circlesPerWindow: 4,
  lanePools: EASY_LANE_POOLS,
  keepLanesChance: 0.8,
  spells: ['heart'],
};
/** Slots of silence before a lane-count change so the player can move their hands (2 beats). */
const SECTION_GAP_SLOTS = 8;
/** Notes on (near-)silent slots are dropped — a note with nothing to hear feels random. */
/** Quiet phrases are scaled so their own peaks reach this salience. */
const BOOST_TARGET = 0.65;
const MAX_BOOST = 10;

const HOLD_CHANCE = [0.9, 0.7, 0.45] as const; // by intensity
const HOLD_BUDGET = 3;
/** Share of long holds (≥ 1 beat) that become slides into a neighbouring lane. */
const SLIDE_CHANCE = 0.4;
/** Two-finger rule: at most ONE hold-type note (hold / roll / slide) at a time (`activeHold` below), chords only while nothing is held. */
const MAX_CHORD = 2;
/** Streams: the last bar of an intense phrase whose pattern has four audible eighths on the second half ends in a 4-tap roll. */
const ROLL_STREAM_MIN_STRENGTH = 0.35;
const ROLL_COOLDOWN_BARS = 2;
/** A roll never asks for more than this many taps per second (fast songs get fewer taps, or no roll at all). */
const ROLL_MAX_TAPS_PER_SEC = 6;
/** Sustained bass-heavy sounds (drops, rumbles) become rolls this often (decided per phrase step, so the figure repeats). */
const ROLL_ON_BASS_CHANCE = 0.5;

/** A spell note every this many bars, starting at bar 4 (after the intro). */
const SPELL_EVERY_BARS = 8;
/** Slow-motion is a tool for the hard songs: only charts rated at least this many stars carry it. */
const SLOW_FROM_STARS = 7;

/** Circle windows: an intense phrase start switches to circles ONLY, on every pattern hit, for 2–4 bars while the pattern stays strong. */
const CIRCLE_WINDOW_MIN_BARS = 2;
const CIRCLE_WINDOW_MAX_BARS = 4;
/** A bar extends the window while its pattern hits keep this share of the first bar's strength. */
const CIRCLE_KEEP_REL = 0.75;
/** Songs this hard may open a window at EVERY intense phrase start (others only on 8-bar boundaries). */
const CIRCLE_EVERY_PHRASE_STARS = 6;
/** Lane bars between two windows — at most a third of the song is circles. */
const CIRCLE_COOLDOWN_BARS = 8;

export interface ComposeOptions {
  seed?: number;
  /** Difficulty profile; default NORMAL. */
  profile?: Profile;
  /** Let the lane count follow the music (2–6 lanes). Default on. */
  laneVariation?: boolean;
}

/** Keep at most `limit(bar)` distinct note times in any 1-second window, dropping the least salient extras. */
function capDensity(events: Event[], slots: readonly Slot[], limit: (bar: Bar) => number): Event[] {
  const kept: Event[] = [];
  const weight = (e: Event) => salience(slots[e.si]) + (e.step % 4 === 0 ? 0.3 : 0) + (e.accent ? 0.2 : 0) + (e.kind ? 1 : 0);
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

export function composeChart(analysis: SongAnalysis, opts: ComposeOptions = {}): ChartLevel {
  const seed = opts.seed ?? 1337;
  const P = opts.profile ?? NORMAL;
  const random = rng(seed);
  const slots = analysis.slots;
  if (slots.length < STEPS_PER_BAR) return { stars: 1, notes: [], sections: [[0, LANE_COUNT]] };

  const bars = groupBars(slots);
  rateIntensity(bars);
  const energetic = isEnergetic(bars);
  // Quiet phrases (intros, breakdowns) are boosted so their own peaks still get sparse notes;
  // true silence stays empty thanks to the absolute floor below.
  const phrasesRaw: Bar[][] = [];
  for (let p = 0; p * PHRASE_BARS < bars.length; p++) phrasesRaw.push(bars.slice(p * PHRASE_BARS, (p + 1) * PHRASE_BARS));
  const boost = new Map<number, number>();
  for (const phrase of phrasesRaw) {
    const peak = percentile(
      phrase.flatMap((b) => b.slots.map(salience)),
      0.9,
    );
    const factor = peak >= MIN_RAW_STRENGTH ? Math.min(MAX_BOOST, Math.max(1, BOOST_TARGET / peak)) : 1;
    for (const b of phrase) boost.set(b.index, factor);
  }
  const sal = slots.map((s) => Math.min(1, salience(s) * (boost.get(s.bar) ?? 1)));
  // Drum fills are found before the lane plan: a lane change needs two beats of silence, and a
  // fill lives exactly there — so the plan keeps the lane count across a boundary that ends in a fill.
  const fills = new Map<number, { from: number; taps: number }>();
  // Phrase-end turnarounds (an intense last bar with four audible eighths on its second half) are
  // roll candidates too — see the stream rule below — so they keep the lane count as well.
  const turnarounds = new Set<number>();
  for (const bar of bars) {
    const strength = bar.slots.map((_s, k) => sal[bar.start + k]);
    const f = detectFill(bar, strength);
    if (f) fills.set(bar.index, f);
    if (bar.index % PHRASE_BARS === PHRASE_BARS - 1 && bar.intensity === 2 && [8, 10, 12, 14].every((i) => strength[i] >= ROLL_STREAM_MIN_STRENGTH))
      turnarounds.add(bar.index);
  }
  const sections = planSections(bars, opts.laneVariation ?? true, random, energetic, new Set([...fills.keys(), ...turnarounds]), P.lanePools, P.keepLanesChance);
  const densityLimit = (bar: Bar): number => (bar.intensity === 2 && energetic ? P.densityPeak : P.density[bar.intensity]);
  const barSeconds = (bar: Bar): number => slots[Math.min(slots.length - 1, bar.start + bar.slots.length)].time - slots[bar.start].time;
  const barCap = (bar: Bar): number =>
    Math.max(1, Math.min(P.maxNotes[bar.intensity], P.maxNotesByLanes[bar.lanes] ?? 16, Math.floor(densityLimit(bar) * Math.max(0.5, barSeconds(bar)))));

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
    for (let k = 0; k < STEPS_PER_BAR; k++) profile[k] = counts[k] ? profile[k] / counts[k] : 0;
    const intense = phraseBars.reduce((a, b) => a + b.intensity, 0) / phraseBars.length >= 1.5;
    const cap = Math.max(...phraseBars.map(barCap));
    const steps = patternSteps(profile, intense, cap, P.gap ?? undefined);
    const pmax = Math.max(...profile);
    const accents = new Set(steps.filter((s) => profile[s] >= ACCENT_REL * pmax));
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
  const phraseOf = (bar: Bar): PhrasePattern => phrases[Math.floor(bar.index / PHRASE_BARS)] ?? phrases[phrases.length - 1];
  /** Does this bar sound the phrase's pattern step? (Its own hit must be there, not just the phrase average.) */
  const sounds = (phrase: PhrasePattern, bar: Bar, step: number): boolean => {
    if (step >= bar.slots.length) return false;
    const gi = bar.start + step;
    return bar.slots[step].strength >= MIN_RAW_STRENGTH && sal[gi] >= Math.max(MIN_NOTE_STRENGTH, SOUND_REL * phrase.profile[step]);
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
    const gap = P.gap ?? (bar.intensity === 2 ? MIN_GAP_INTENSE : MIN_GAP_SLOTS);
    let rollFrom = -1;
    let rollTaps = 0;
    const fill = P.rolls ? fills.get(bar.index) : undefined;
    if (fill) {
      rollFrom = fill.from;
      rollTaps = fill.taps;
    }
    // Stream → roll: the last bar of an intense phrase with four audible eighths on the second half
    // (at least two of them part of the figure) ends in "drum it" — the same four hits, in one lane as a Taiko-style roll. Always
    // on the phrase end, so the 4-bar figure reads as three bars of pattern + one turnaround.
    if (
      P.rolls &&
      rollFrom < 0 &&
      phraseEnd &&
      bar.intensity === 2 &&
      bar.index - lastRollBar >= ROLL_COOLDOWN_BARS &&
      [8, 10, 12, 14].every((i) => strength[i] >= ROLL_STREAM_MIN_STRENGTH) &&
      [8, 10, 12, 14].filter((i) => phrase.steps.includes(i)).length >= 2
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
    const fits = (step: number) => !placed.some((st) => Math.abs(st - step) < gap);
    for (const step of phrase.steps) {
      if (placed.length >= cap) break;
      if (rollFrom >= 0 && step >= rollFrom) continue;
      if (!sounds(phrase, bar, step) || !fits(step)) continue;
      placed.push(step);
    }
    // Extras: off-pattern hits only when very strong (fills, stabs) and a clear local peak of this bar.
    const extras: { step: number; score: number }[] = [];
    for (let step = 0; P.extras && step < bar.slots.length; step++) {
      if (rollFrom >= 0 && step >= rollFrom) continue;
      if (phrase.steps.includes(step)) continue;
      const gi = bar.start + step;
      const v = sal[gi];
      if (v < EXTRA_REL * phrase.salMax || bar.slots[step].strength < MIN_RAW_STRENGTH) continue;
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
        kind: 'roll',
        taps: Math.max(ROLL_MIN_TAPS, Math.min(rollTaps, len)),
        accent: false,
      });
    }
  }

  // 1b. Breathing room before every lane-count change, and the rolling per-second cap.
  const lastBarOfSection = new Set<number>();
  for (let i = 0; i + 1 < bars.length; i++) if (bars[i + 1].lanes !== bars[i].lanes) lastBarOfSection.add(bars[i].index);
  let filtered = events.filter((ev) => !(lastBarOfSection.has(ev.bar.index) && ev.step >= STEPS_PER_BAR - SECTION_GAP_SLOTS));
  filtered = capDensity(filtered, slots, densityLimit);
  events.length = 0;
  events.push(...filtered);

  // 1c. Circle windows: when an intense phrase (chorus / drop) starts, its first bars switch to
  // osu!-style hit circles ONLY — lane notes are cleared there (plus one beat before) — and a
  // circle sits on EVERY pattern hit of the window, so the figure keeps going as circles. The
  // window lasts 2–4 bars while the pattern stays strong. Hard songs may open one at every
  // intense phrase start; easier ones only on 8-bar boundaries. Modes never mix.
  const provisional = rateStars(eventsToTuples(events, slots), analysis.bpm, sections);
  const everyPhrase = provisional >= CIRCLE_EVERY_PHRASE_STARS;
  const patternStrength = (phrase: PhrasePattern, bar: Bar): number => {
    let sum = 0;
    for (const s of phrase.steps) if (s < bar.slots.length) sum += sal[bar.start + s];
    return sum;
  };
  let lastWindowEnd = -100;
  for (const bar of bars) {
    if (bar.index % PHRASE_BARS !== 0 || bar.intensity !== 2 || bar.index < 4) continue;
    if (!everyPhrase && bar.index % (PHRASE_BARS * 2) !== 0) continue;
    if (bar.index < lastWindowEnd + CIRCLE_COOLDOWN_BARS) continue;
    const phrase = phraseOf(bar);
    if (!phrase.steps.length) continue;
    const head = patternStrength(phrase, bar);
    if (head <= 0) continue;
    const windowBars: Bar[] = [];
    for (let k = 0; k < CIRCLE_WINDOW_MAX_BARS && k < phrase.bars.length; k++) {
      const wb = phrase.bars[k];
      if (k >= CIRCLE_WINDOW_MIN_BARS && (wb.intensity !== 2 || patternStrength(phrase, wb) < CIRCLE_KEEP_REL * head)) break;
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
      else if (e.hold > 0 && e.si < startSi - 4 && e.si + e.hold > startSi - 4) {
        e.hold = Math.max(2, startSi - 4 - e.si);
        if (e.kind === 'roll') {
          // A shortened roll must not become a tap-rate impossibility: fewer taps, or a plain tap.
          const dur = slots[Math.min(slots.length - 1, e.si + e.hold)].time - slots[e.si].time;
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
      const gapFrom = lastBarOfSection.has(wb.index) ? STEPS_PER_BAR - SECTION_GAP_SLOTS : Infinity;
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
      if (chosen.length >= P.circlesPerWindow) break;
      if (chosen.some((c) => Math.abs(c.si - h.si) < P.circleGapSlots)) continue;
      chosen.push(h);
    }
    for (const c of chosen)
      events.push({
        si: c.si,
        bar: c.bar,
        step: c.si - c.bar.start,
        size: 1,
        hold: 0,
        kind: 'circle',
        taps: 0,
        accent: false,
      });
  }
  events.sort((a, b) => a.si - b.si);
  filtered = capDensity(events, slots, densityLimit);
  events.length = 0;
  events.push(...filtered);

  // 1d. Spell notes: the first plain lane note of every 8th bar (from bar 4) alternates through the
  //     profile's spells (slow-motion is swapped for a heart below SLOW_FROM_STARS once the chart is rated).
  const spells = P.spells;
  let spellCount = 0;
  for (let b = 4; b < bars.length; b += SPELL_EVERY_BARS) {
    const ev = events.find((e) => e.bar.index === b && !e.kind && !e.hold) ?? events.find((e) => e.bar.index === b + 1 && !e.kind && !e.hold);
    if (!ev) continue;
    if (!spells.length) break;
    ev.kind = spells[spellCount++ % spells.length];
  }

  // 2. Holds on sustained melodic sounds (some become slides), chords on accents — under the
  //    two-finger rule. Hold / slide / bass-roll decisions are taken per (phrase, step), so the
  //    same step of the figure gets the same treatment in every bar of the phrase.
  const holdBudget = new Map<number, number>();
  let activeHold: Event | null = null;
  /** A long note must end a beat before the next circle: circle windows are circles only, and the free thumb taps them. */
  const clampBeforeCircle = (i: number, len: number): number => {
    const si = events[i].si;
    for (let j = i + 1; j < events.length && events[j].si < si + len + 4; j++) {
      if (events[j].kind === 'circle') return Math.min(len, events[j].si - 4 - si);
    }
    return len;
  };
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const slot = slots[ev.si];
    const gapNext = i + 1 < events.length ? events[i + 1].si - ev.si : Infinity;
    const gapPrev = i > 0 ? ev.si - events[i - 1].si : Infinity;
    const intensity = ev.bar.intensity;
    const phraseIdx = Math.floor(ev.bar.index / PHRASE_BARS);

    if (activeHold && activeHold.si + activeHold.hold <= ev.si) activeHold = null;
    if (ev.kind === 'roll') {
      // A drum fill beats a sustained note: a plain hold still ringing is cut short at the roll
      // (if that leaves it ≥ 2 slots); a roll or slide in progress keeps its thumb, the fill stays taps.
      if (activeHold && !activeHold.kind && ev.si - activeHold.si >= 2) activeHold.hold = ev.si - activeHold.si;
      else if (activeHold) {
        ev.kind = null;
        ev.hold = 0;
        ev.taps = 0;
        continue;
      }
      activeHold = ev;
      continue;
    }
    if (ev.kind) continue; // spells and circles stay plain taps
    const budget = holdBudget.get(ev.bar.index) ?? HOLD_BUDGET;
    const melodic = slot.low < 0.55;
    const bassLen = clampBeforeCircle(i, Math.min(slot.sustain, gapNext, 8));
    const bassDur = slots[Math.min(slots.length - 1, ev.si + bassLen)].time - slot.time;
    const bassTaps = Math.min(ROLL_MAX_TAPS, Math.round(bassLen / 2) + 1, Math.floor(bassDur * ROLL_MAX_TAPS_PER_SEC));
    if (
      P.rolls &&
      slot.sustain >= 4 &&
      !melodic &&
      intensity >= 1 &&
      budget > 0 &&
      !activeHold &&
      gapNext >= 3 &&
      bassTaps >= ROLL_MIN_TAPS &&
      decide(seed, phraseIdx, ev.step, 1) < ROLL_ON_BASS_CHANCE
    ) {
      const len = bassLen;
      ev.kind = 'roll';
      ev.hold = len;
      ev.taps = bassTaps;
      ev.size = 1;
      holdBudget.set(ev.bar.index, budget - 1);
      activeHold = ev;
      continue;
    }
    if (
      slot.sustain >= 2 &&
      melodic &&
      budget > 0 &&
      !activeHold &&
      decide(seed, phraseIdx, ev.step, 2) < HOLD_CHANCE[intensity]
    ) {
      let dur = clampBeforeCircle(i, Math.min(slot.sustain, P.maxHoldSlots));
      const barEnd = ev.bar.start + ev.bar.slots.length;
      if (lastBarOfSection.has(ev.bar.index)) dur = Math.min(dur, barEnd - SECTION_GAP_SLOTS - ev.si);
      else if (lastBarOfSection.has(ev.bar.index + 1)) dur = Math.min(dur, barEnd + STEPS_PER_BAR - SECTION_GAP_SLOTS - ev.si);
      if (dur >= 2) {
        ev.hold = dur;
        ev.size = 1;
        if (P.slides && dur >= 4 && intensity >= 1 && ev.bar.lanes >= 3 && decide(seed, phraseIdx, ev.step, 3) < SLIDE_CHANCE) ev.kind = 'slide';
        holdBudget.set(ev.bar.index, budget - 1);
        activeHold = ev;
        continue;
      }
    }

    if (activeHold) continue; // two-finger rule: one thumb is busy → an accent lands in an outer lane instead
    const inStream = gapPrev <= 1 || gapNext <= 1;
    if (!P.chords || !ev.accent || inStream || ev.bar.lanes < 2) continue;
    ev.size = MAX_CHORD;
  }

  // 2a. Nothing else while a slide is in progress — a moving thumb cannot tap.
  const slideSpans = events.filter((e) => e.kind === 'slide').map((e) => [e.si, e.si + e.hold] as const);
  const playable = events.filter((e) => e.kind === 'slide' || !slideSpans.some(([a, b]) => e.si > a && e.si < b));

  // 3. Lanes.
  const notes = assignLanes(playable, slots, random);
  const stars = rateStars(notes, analysis.bpm, sections);
  if (stars < SLOW_FROM_STARS) for (const n of notes) if (n[3] === 'slow') n[3] = 'heart';
  return { stars, notes, sections };
}
