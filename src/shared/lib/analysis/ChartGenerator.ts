import { DENSITY_LIMIT, LANE_COUNT } from '@/shared/config/constants';
import { percentile } from '@/shared/lib/math';
import type { ChartLevel, NoteKind, NoteTuple, SectionTuple, SpellKind } from '@/shared/types/chart';
import { STEPS_PER_BAR, type Slot, type SongAnalysis } from './SongAnalyzer';

/**
 * Chart composer: turns the analysed beat grid into ONE playable, musical chart per song.
 *
 * Notes sit on the music's own hits: a sixteenth slot gets a note when it is a local peak of onset
 * salience (kick, snare, strum, vocal attack…) that stands out against its phrase — played by ear,
 * not by pattern — capped per bar by the bar's intensity. Then the song's own structure
 * adds the mechanics: sustained melodic sounds → holds (some of them slides to a neighbouring
 * lane), drum fills → rolls, chorus starts → circle-only windows, phrases → lane-count changes.
 * Everything sits on the grid, and everything is playable with two thumbs.
 */

export type Category = 'rest' | 'base' | 'sync' | 'eighth' | 'fill';

export interface Template {
  id: string;
  mask: string;
  category: Category;
  count: number;
}

const T = (id: string, mask: string, category: Category): Template => ({ id, mask, category, count: mask.split('1').length - 1 });

/** 16 steps per bar; `1` = note. Read as four beats of four sixteenths. */
export const TEMPLATES: readonly Template[] = [
  T('rest', '0000000000000000', 'rest'),
  T('half', '1000000010000000', 'base'),
  T('quarter', '1000100010001000', 'base'),
  T('q-pickup', '1000100010001010', 'base'),
  T('q-2and4', '1000101010001010', 'base'),
  T('tresillo', '1001001010010010', 'sync'),
  T('offbeat', '0010001000100010', 'sync'),
  T('sync-a', '1000001010000010', 'sync'),
  T('sync-b', '1010001010100010', 'sync'),
  T('eighth', '1010101010101010', 'eighth'),
  T('e-rest4', '1010101010100000', 'eighth'),
  T('e-fill', '1010101010101111', 'fill'),
  T('q-fill', '1000100010001111', 'fill'),
  T('q-fill2', '1000100011111111', 'fill'),
];

/** Max notes per bar by intensity [quiet, medium, intense]. */
const MAX_NOTES: readonly [number, number, number] = [2, 4, 6];
/** Fewer lanes → fewer notes per bar. */
const MAX_NOTES_BY_LANES: Record<number, number> = { 2: 4, 3: 5 };
/** Slots of silence before a lane-count change so the player can move their hands (2 beats). */
const SECTION_GAP_SLOTS = 8;
/** Notes on (near-)silent slots are dropped — a note with nothing to hear feels random. */
const MIN_NOTE_STRENGTH = 0.1;
/** A hit must reach this share of the phrase's 90th-percentile salience to earn a note. */
const PEAK_REL_THRESHOLD = 0.42;
/** No two plain notes closer than an eighth (consecutive sixteenths belong to rolls). */
const MIN_GAP_SLOTS = 2;
/** Absolute floor on raw onset strength: below this a slot is silence, whatever the phrase boost says. */
const MIN_RAW_STRENGTH = 0.05;
/** Quiet phrases are scaled so their own peaks reach this salience (enough to beat the template's per-note penalty). */
const BOOST_TARGET = 0.65;
const MAX_BOOST = 10;

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
/** Streams: in intense bars, audible eighths on the second half become one 4-tap roll this often (with a 2-bar cooldown). */
const ROLL_STREAM_CHANCE = 0.45;
const ROLL_STREAM_MIN_STRENGTH = 0.35;
const ROLL_COOLDOWN_BARS = 2;
/** A roll never asks for more than this many taps per second (fast songs get fewer taps, or no roll at all). */
const ROLL_MAX_TAPS_PER_SEC = 6;
/** Sustained bass-heavy sounds (drops, rumbles) become rolls this often. */
const ROLL_ON_BASS_CHANCE = 0.5;

/** A spell note every this many bars, starting at bar 4 (after the intro). */
const SPELL_EVERY_BARS = 8;
const SPELL_ORDER: readonly SpellKind[] = ['slow', 'heart'];

/** Circle windows: the first bars of an intense phrase hold ONLY circles (no lane notes), on the strongest hits. */
const CIRCLE_WINDOW_BARS = 2;
const CIRCLES_PER_WINDOW = 4;
const CIRCLE_MIN_GAP_SLOTS = 4; // one beat
const CIRCLE_MIN_SALIENCE = 0.3;

/** Lane-count sections: one decision per 8-bar phrase, pools by [quiet, medium, intense]. */
const PHRASE_BARS = 8;
const LANE_POOLS: readonly [readonly number[], readonly number[], readonly number[]] = [[3], [4], [5]];

export interface ComposeOptions {
  seed?: number;
  /** Let the lane count follow the music (3–5 lanes). Default on. */
  laneVariation?: boolean;
}

interface Bar {
  index: number;
  start: number; // slot index
  slots: Slot[];
  intensity: 0 | 1 | 2;
  lanes: number;
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

function groupBars(slots: readonly Slot[]): Bar[] {
  const bars: Bar[] = [];
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    let bar = bars[bars.length - 1];
    if (!bar || bar.index !== s.bar) {
      bar = { index: s.bar, start: i, slots: [], intensity: 1, lanes: LANE_COUNT };
      bars.push(bar);
    }
    bar.slots.push(s);
  }
  return bars;
}

/** Bar intensity from smoothed mean onset strength: quantiles over the track with absolute floors. */
export function rateIntensity(bars: Bar[]): void {
  const e = bars.map((b) => b.slots.reduce((acc, s) => acc + s.strength, 0) / Math.max(1, b.slots.length));
  // Smooth within an 8-bar phrase only: a chorus starting at bar 8 must not be dragged down by the intro.
  const sm = e.map((_, i) => {
    const prev = i % PHRASE_BARS === 0 ? e[i] : (e[i - 1] ?? e[i]);
    const next = i % PHRASE_BARS === PHRASE_BARS - 1 ? e[i] : (e[i + 1] ?? e[i]);
    return 0.25 * prev + 0.5 * e[i] + 0.25 * next;
  });
  const q35 = percentile(sm, 0.35);
  const q70 = percentile(sm, 0.7);
  for (let i = 0; i < bars.length; i++) {
    const v = sm[i];
    bars[i].intensity = v >= Math.max(q70, 0.3) ? 2 : v >= Math.max(q35, 0.1) ? 1 : 0;
  }
}

/**
 * Lane count per 8-bar phrase: calm parts shrink to 3 lanes, choruses open up to 5.
 * The intro always starts on 4 lanes; a phrase with the same energy as the previous one
 * usually keeps its lane count so a chorus reads as one block.
 */
export function planSections(bars: Bar[], variation: boolean, random: () => number): SectionTuple[] {
  for (const b of bars) b.lanes = LANE_COUNT;
  if (!variation || bars.length < PHRASE_BARS * 2) return [[0, LANE_COUNT]];
  const sections: SectionTuple[] = [];
  let prevLanes = LANE_COUNT;
  let prevIntensity = -1;
  for (let p = 0; p * PHRASE_BARS < bars.length; p++) {
    const phrase = bars.slice(p * PHRASE_BARS, (p + 1) * PHRASE_BARS);
    const intensity = Math.round(phrase.reduce((a, b) => a + b.intensity, 0) / phrase.length) as 0 | 1 | 2;
    let lanes: number;
    if (p === 0) lanes = LANE_COUNT;
    else if (intensity === prevIntensity && random() < 0.7) lanes = prevLanes;
    else {
      const pool = LANE_POOLS[intensity];
      const fresh = pool.filter((n) => n !== prevLanes);
      const from = fresh.length ? fresh : pool;
      lanes = from[Math.floor(random() * from.length)];
    }
    for (const b of phrase) b.lanes = lanes;
    const time = round3(phrase[0].slots[0].time);
    if (!sections.length || sections[sections.length - 1][1] !== lanes) sections.push([sections.length ? time : 0, lanes]);
    prevLanes = lanes;
    prevIntensity = intensity;
  }
  return sections;
}

/** How well a template fits the bar: reward notes on strong slots, punish notes on silence and missed hits. */
export function scoreTemplate(t: Template, strength: readonly number[], intensity: number, phraseEnd: boolean): number {
  let s = 0;
  for (let i = 0; i < STEPS_PER_BAR; i++) {
    const v = strength[i] ?? 0;
    if (t.mask[i] === '1') s += v - 0.4;
    else s -= 0.8 * Math.max(0, v - 0.5);
  }
  s += 0.03 * t.count * (intensity - 1);
  if (phraseEnd && t.category === 'fill') s += 0.15;
  return s;
}

/** Keep at most `limit` distinct note times in any 1-second window, dropping the least salient extras. */
function capDensity(events: Event[], slots: readonly Slot[], limit: number): Event[] {
  const kept: Event[] = [];
  for (const ev of events) {
    kept.push(ev);
    const t = slots[ev.si].time;
    const window = kept.filter((e) => slots[e.si].time > t - 1);
    if (window.length <= limit) continue;
    let weakest = window[0];
    for (const e of window) {
      const a = salience(slots[e.si]) + (e.step % 4 === 0 ? 0.3 : 0) + (e.kind ? 1 : 0);
      const b = salience(slots[weakest.si]) + (weakest.step % 4 === 0 ? 0.3 : 0) + (weakest.kind ? 1 : 0);
      if (a < b) weakest = e;
    }
    kept.splice(kept.indexOf(weakest), 1);
  }
  return kept;
}

export function composeChart(analysis: SongAnalysis, opts: ComposeOptions = {}): ChartLevel {
  const random = rng(opts.seed ?? 1337);
  const slots = analysis.slots;
  if (slots.length < STEPS_PER_BAR) return { stars: 1, notes: [], sections: [[0, LANE_COUNT]] };

  const bars = groupBars(slots);
  rateIntensity(bars);
  const sections = planSections(bars, opts.laneVariation ?? true, random);

  // Quiet phrases (intros, breakdowns) are boosted so their own peaks still get sparse notes;
  // true silence stays empty thanks to the absolute floor below.
  const boost = new Map<number, number>();
  for (let p = 0; p * PHRASE_BARS < bars.length; p++) {
    const phrase = bars.slice(p * PHRASE_BARS, (p + 1) * PHRASE_BARS);
    const peak = percentile(phrase.flatMap((b) => b.slots.map(salience)), 0.9);
    const factor = peak >= MIN_RAW_STRENGTH ? Math.min(MAX_BOOST, Math.max(1, BOOST_TARGET / peak)) : 1;
    for (const b of phrase) boost.set(b.index, factor);
  }

  // 1. Notes on the music's own hits. A slot is a candidate when its (boosted) salience is a local
  //    peak — the hit is here, not on the neighbouring sixteenth — and stands out against the
  //    phrase. Beats and eighths are preferred over off-sixteenths; per-bar caps by intensity keep
  //    it playable. Drum fills and chorus streams become rolls.
  const sal = slots.map((s) => Math.min(1, salience(s) * (boost.get(s.bar) ?? 1)));
  const thr = new Map<number, number>();
  for (let p = 0; p * PHRASE_BARS < bars.length; p++) {
    const phrase = bars.slice(p * PHRASE_BARS, (p + 1) * PHRASE_BARS);
    const peak = percentile(phrase.flatMap((b) => b.slots.map((_s, k) => sal[b.start + k])), 0.9);
    for (const b of phrase) thr.set(b.index, Math.max(MIN_NOTE_STRENGTH, PEAK_REL_THRESHOLD * peak));
  }
  const events: Event[] = [];
  let lastRollBar = -10;
  for (const bar of bars) {
    const maxNotes = Math.min(MAX_NOTES[bar.intensity], MAX_NOTES_BY_LANES[bar.lanes] ?? 16);
    const strength = bar.slots.map((_s, k) => sal[bar.start + k]);
    const phraseEnd = bar.index % 4 === 3;
    // Drum fill → roll: the bar ends with one or two beats where EVERY sixteenth sounds and the
    // off-sixteenths are clearly louder than in the rest of the bar (a fill, not a steady stream).
    // Phrase ends (bar 4/8/…) need less evidence — that is where fills live.
    let rollFrom = -1;
    let rollTaps = 0;
    if (bar.intensity >= 1) {
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
        const contrast = offRun / Math.max(1, offRunN) / Math.max(0.06, offRest / Math.max(1, offRestN));
        if (contrast >= ROLL_CONTRAST) {
          rollFrom = from;
          rollTaps = Math.min(ROLL_MAX_TAPS, len);
          break;
        }
      }
    }
    // Stream → roll: a chorus bar whose second half has four audible eighths becomes "drum it" —
    // the same four hits the player would tap anyway, but in one lane as a Taiko-style roll.
    if (
      rollFrom < 0 &&
      bar.intensity === 2 &&
      bar.index - lastRollBar >= ROLL_COOLDOWN_BARS &&
      [8, 10, 12, 14].every((i) => strength[i] >= ROLL_STREAM_MIN_STRENGTH) &&
      random() < ROLL_STREAM_CHANCE
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
    const floor = thr.get(bar.index) ?? MIN_NOTE_STRENGTH;
    const cand: { step: number; score: number }[] = [];
    for (let step = 0; step < bar.slots.length; step++) {
      if (rollFrom >= 0 && step >= rollFrom) continue;
      const gi = bar.start + step;
      const v = sal[gi];
      if (v < floor || bar.slots[step].strength < MIN_RAW_STRENGTH) continue;
      if (v < (sal[gi - 1] ?? 0) || v < (sal[gi + 1] ?? 0)) continue;
      const gridBonus = step % 4 === 0 ? 0.15 : step % 2 === 0 ? 0.05 : -0.12;
      cand.push({ step, score: v + gridBonus + (step % 8 === 0 ? 0.03 : 0) });
    }
    cand.sort((a, b) => b.score - a.score);
    const chosen: number[] = [];
    for (const c of cand) {
      if (chosen.length >= maxNotes) break;
      if (chosen.some((st) => Math.abs(st - c.step) < MIN_GAP_SLOTS)) continue;
      chosen.push(c.step);
    }
    chosen.sort((a, b) => a - b);
    for (const step of chosen) events.push({ si: bar.start + step, bar, step, size: 1, hold: 0, kind: null, taps: 0 });
    if (rollFrom >= 0 && rollFrom < bar.slots.length) {
      const len = bar.slots.length - rollFrom;
      events.push({ si: bar.start + rollFrom, bar, step: rollFrom, size: 1, hold: len, kind: 'roll', taps: Math.max(ROLL_MIN_TAPS, Math.min(rollTaps, len)) });
    }
  }

  // 1a. Breathing room before every lane-count change, and a hard per-second cap (sliding window).
  const lastBarOfSection = new Set<number>();
  for (let i = 0; i + 1 < bars.length; i++) if (bars[i + 1].lanes !== bars[i].lanes) lastBarOfSection.add(bars[i].index);
  let filtered = events.filter((ev) => !(lastBarOfSection.has(ev.bar.index) && ev.step >= STEPS_PER_BAR - SECTION_GAP_SLOTS));
  filtered = capDensity(filtered, slots, DENSITY_LIMIT);
  events.length = 0;
  events.push(...filtered);

  // 1b. Circle windows: when an intense phrase (chorus / drop) starts, its first bars switch to
  // osu!-style hit circles ONLY — lane notes are cleared there (plus one beat before), and the
  // circles sit on the strongest hits of the window, at least a beat apart. Modes never mix.
  for (const bar of bars) {
    if (bar.index % PHRASE_BARS !== 0 || bar.intensity !== 2 || bar.index < 4) continue;
    const windowBars = bars.slice(bar.index, bar.index + CIRCLE_WINDOW_BARS);
    const startSi = bar.start;
    const endSi = windowBars[windowBars.length - 1].start + windowBars[windowBars.length - 1].slots.length;
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
    const candidates: number[] = [];
    for (let si = startSi; si < endSi; si++) if (salience(slots[si]) >= CIRCLE_MIN_SALIENCE) candidates.push(si);
    candidates.sort((a, b) => salience(slots[b]) - salience(slots[a]));
    const chosen: number[] = [];
    for (const si of candidates) {
      if (chosen.length >= CIRCLES_PER_WINDOW) break;
      if (chosen.some((c) => Math.abs(c - si) < CIRCLE_MIN_GAP_SLOTS)) continue;
      chosen.push(si);
    }
    for (const si of chosen) {
      const b = windowBars.find((wb) => si >= wb.start && si < wb.start + wb.slots.length) ?? bar;
      events.push({ si, bar: b, step: si - b.start, size: 1, hold: 0, kind: 'circle', taps: 0 });
    }
  }
  events.sort((a, b) => a.si - b.si);

  // 1c. Spell notes: the first plain lane note of every 8th bar (from bar 4) alternates slow / heart.
  let spellCount = 0;
  for (let b = 4; b < bars.length; b += SPELL_EVERY_BARS) {
    const ev = events.find((e) => e.bar.index === b && !e.kind && !e.hold) ?? events.find((e) => e.bar.index === b + 1 && !e.kind && !e.hold);
    if (!ev) continue;
    ev.kind = SPELL_ORDER[spellCount++ % SPELL_ORDER.length];
  }

  // 2. Holds on sustained melodic sounds (some become slides), chords on strong downbeats —
  //    under the two-finger rule.
  const holdBudget = new Map<number, number>();
  const chordBudget = new Map<number, number>();
  const activeHoldEnds: number[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const slot = slots[ev.si];
    const gapNext = i + 1 < events.length ? events[i + 1].si - ev.si : Infinity;
    const gapPrev = i > 0 ? ev.si - events[i - 1].si : Infinity;
    const intensity = ev.bar.intensity;

    while (activeHoldEnds.length && activeHoldEnds[0] <= ev.si) activeHoldEnds.shift();
    if (ev.kind === 'roll') {
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
    const bassDur = slots[Math.min(slots.length - 1, ev.si + bassLen)].time - slot.time;
    const bassTaps = Math.min(ROLL_MAX_TAPS, Math.round(bassLen / 2) + 1, Math.floor(bassDur * ROLL_MAX_TAPS_PER_SEC));
    if (slot.sustain >= 4 && !melodic && intensity >= 1 && budget > 0 && !activeHoldEnds.length && gapNext >= 4 && bassTaps >= ROLL_MIN_TAPS && random() < ROLL_ON_BASS_CHANCE) {
      const len = bassLen;
      ev.kind = 'roll';
      ev.hold = len;
      ev.taps = bassTaps;
      holdBudget.set(ev.bar.index, budget - 1);
      activeHoldEnds.push(ev.si + len);
      activeHoldEnds.sort((a, b) => a - b);
      continue;
    }
    if (slot.sustain >= 2 && melodic && budget > 0 && activeHoldEnds.length < MAX_ACTIVE_HOLDS && random() < HOLD_CHANCE[intensity]) {
      let dur = Math.min(slot.sustain, MAX_HOLD_SLOTS);
      const barEnd = ev.bar.start + ev.bar.slots.length;
      if (lastBarOfSection.has(ev.bar.index)) dur = Math.min(dur, barEnd - SECTION_GAP_SLOTS - ev.si);
      else if (lastBarOfSection.has(ev.bar.index + 1)) dur = Math.min(dur, barEnd + STEPS_PER_BAR - SECTION_GAP_SLOTS - ev.si);
      if (dur >= 2) {
        ev.hold = dur;
        if (dur >= 4 && intensity >= 1 && ev.bar.lanes >= 3 && random() < SLIDE_CHANCE) ev.kind = 'slide';
        holdBudget.set(ev.bar.index, budget - 1);
        activeHoldEnds.push(ev.si + dur);
        activeHoldEnds.sort((a, b) => a - b);
        continue;
      }
    }

    if (activeHoldEnds.length) continue; // two-finger rule: one thumb is busy
    const onDown = ev.step === 0 || ev.step === 8;
    const accent = slot.strength >= 0.9;
    const inStream = gapPrev <= 1 || gapNext <= 1;
    const chords = chordBudget.get(ev.bar.index) ?? 0;
    const wantChord = (intensity === 2 && onDown) || (intensity >= 1 && accent && onDown);
    if (!wantChord || chords >= 2 || inStream) continue;
    ev.size = MAX_CHORD;
    chordBudget.set(ev.bar.index, chords + 1);
  }

  // 2a. Nothing else while a slide is in progress — a moving thumb cannot tap.
  const slideSpans = events.filter((e) => e.kind === 'slide').map((e) => [e.si, e.si + e.hold] as const);
  const playable = events.filter((e) => e.kind === 'slide' || !slideSpans.some(([a, b]) => e.si > a && e.si < b));

  // 3. Lanes.
  const notes = assignLanes(playable, slots, random);
  return { stars: rateStars(notes, analysis.bpm), notes, sections };
}

type MotionKind = 'up' | 'down' | 'zigzag' | 'trill';

class Motion {
  private seq: number[];
  private pos = 0;
  constructor(kind: MotionKind, n: number, random: () => number) {
    const up = Array.from({ length: n }, (_, i) => i);
    switch (kind) {
      case 'up':
        this.seq = up;
        break;
      case 'down':
        this.seq = [...up].reverse();
        break;
      case 'zigzag': {
        const z = [...up.filter((l) => l % 2 === 0), ...up.filter((l) => l % 2 === 1)];
        this.seq = random() < 0.5 ? z : z.reverse();
        break;
      }
      case 'trill': {
        const left = up.filter((l) => l < n / 2);
        const right = up.filter((l) => l >= n / 2);
        this.seq = [left[Math.floor(random() * left.length)], right[Math.floor(random() * right.length)]];
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
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  return pairs.filter((p) => p[0] !== p[1] && p[0] >= 0 && p[1] < n);
}

/** Lanes whose centre falls in the band's third of the playfield (thirds overlap so none is empty). */
function bandLanes(n: number, band: 0 | 1 | 2): number[] {
  const out: number[] = [];
  for (let l = 0; l < n; l++) {
    const c = (l + 0.5) / n;
    if ((band === 0 && c < 0.4) || (band === 1 && c > 0.25 && c < 0.75) || (band === 2 && c > 0.6)) out.push(l);
  }
  return out.length ? out : [band === 0 ? 0 : band === 2 ? n - 1 : Math.floor(n / 2)];
}

function assignLanes(events: readonly Event[], slots: readonly Slot[], random: () => number): NoteTuple[] {
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
      const kinds: MotionKind[] = ['up', 'down', 'zigzag', 'trill'];
      motion = new Motion(kinds[Math.floor(random() * kinds.length)], n, random);
    }

    let candidates = free.filter((l) => laneRun[l] < 2);
    if (!candidates.length) candidates = free;

    let lanes: number[];
    if (ev.size >= 2) {
      const pair = chordPairs(n, ev.step === 0).find((p) => p.every((l) => candidates.includes(l)));
      lanes = pair ? [...pair] : [candidates[Math.floor(random() * candidates.length)]];
    } else {
      let lane: number;
      if (gap <= 1 && motion) {
        lane = motion.next(candidates);
      } else if (gap === 2) {
        const side = 1 - lastSide;
        const onSide = candidates.filter((l) => ((l + 0.5) / n < 0.5 ? 0 : 1) === side);
        const pool = onSide.length ? onSide : candidates;
        const band: 0 | 1 | 2 = slot.low >= slot.mid && slot.low >= slot.high ? 0 : slot.high > slot.mid ? 2 : 1;
        const preferred = pool.filter((l) => bandLanes(n, band).includes(l));
        const from = preferred.length ? preferred : pool;
        lane = from[Math.floor(random() * from.length)];
      } else {
        const band: 0 | 1 | 2 = slot.low >= slot.mid && slot.low >= slot.high ? 0 : slot.high > slot.mid ? 2 : 1;
        const group = bandLanes(n, band);
        let pool = candidates.filter((l) => group.includes(l));
        if (!pool.length) pool = candidates;
        const fresh = pool.filter((l) => l !== lastLane);
        const choose = fresh.length && random() < 0.8 ? fresh : pool;
        lane = choose[Math.floor(random() * choose.length)];
        if (ev.kind === 'circle') {
          // Circles zig-zag across the whole field so a group reads as a path: left, right, centre, …
          const spread = [0, n - 1, Math.floor(n / 2), 1, n - 2, Math.floor(n / 2) - 1].filter((l, i, arr) => l >= 0 && l < n && arr.indexOf(l) === i);
          if (ev.si - lastCircleSi > 24) {
            // New group: start the path on a lane the player has not just been hammering.
            circleIdx = 0;
            circleOffset = Math.max(0, spread.findIndex((l) => laneRun[l] < 2));
          } else circleIdx++;
          lastCircleSi = ev.si;
          lane = spread[(circleOffset + circleIdx) % spread.length];
        }
      }
      lanes = [lane];
    }

    const time = round3(slot.time);
    for (const lane of lanes) {
      if (ev.hold > 0) {
        const endIdx = Math.min(slots.length - 1, ev.si + ev.hold);
        const dur = round3(slots[endIdx].time - slot.time);
        if (ev.kind === 'roll') {
          notes.push([time, lane, dur, 'roll', ev.taps]);
          heldUntil[lane] = endIdx;
        } else if (ev.kind === 'slide') {
          // Slide into the free lane next door (never across a lane); both lanes are blocked for the duration.
          const options = [lane + 1, lane - 1].filter((l) => l >= 0 && l < n && heldUntil[l] < ev.si);
          if (options.length) {
            const end = options[Math.floor(random() * Math.min(2, options.length))];
            notes.push([time, lane, dur, 'slide', end]);
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
    for (let l = 0; l < 8; l++) laneRun[l] = lanes.includes(l) ? laneRun[l] + 1 : 0;
    const primary = lanes[lanes.length - 1];
    lastLane = primary;
    lastSide = (primary + 0.5) / n < 0.5 ? 0 : 1;
    lastSi = ev.si;
  }

  notes.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return notes;
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * Difficulty rating 1–10: average density, how much the peaks exceed it, share of hold-type notes,
 * share of special mechanics (slides / rolls / circles) and tempo (faster songs scroll faster).
 */
export function rateStars(notes: readonly NoteTuple[], bpm = 120): number {
  if (notes.length < 2) return 1;
  const times = [...new Set(notes.map((n) => n[0]))];
  const span = Math.max(1, times[times.length - 1] - times[0]);
  const avgNps = notes.length / span;
  let peak = 0;
  let j = 0;
  for (let i = 0; i < times.length; i++) {
    while (times[i] - times[j] > 2) j++;
    peak = Math.max(peak, (i - j + 1) / 2);
  }
  const holds = notes.filter((n) => n.length >= 3 && (n[2] as number) > 0).length / notes.length;
  const special = notes.filter((n) => n[3] === 'slide' || n[3] === 'roll' || n[3] === 'circle').length / notes.length;
  const tempo = Math.max(0, Math.min(1, (bpm - 120) / 70));
  const raw = avgNps * 2.4 + Math.max(0, peak - avgNps) * 0.6 + holds + special * 3 + tempo * 1.2 - 0.6;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

/** Mechanic counts for the song card. */
export function chartFeatures(level: ChartLevel): { circles: number; rolls: number; slides: number; holds: number; laneChanges: number } {
  const kind = (k: NoteKind) => level.notes.filter((n) => n[3] === k).length;
  return {
    circles: kind('circle'),
    rolls: kind('roll'),
    slides: kind('slide'),
    holds: level.notes.filter((n) => n.length === 3 && (n[2] as number) > 0).length,
    laneChanges: Math.max(0, (level.sections?.length ?? 1) - 1),
  };
}
