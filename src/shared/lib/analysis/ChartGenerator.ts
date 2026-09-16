import { LANE_COUNT } from '@/shared/config/constants';
import { percentile } from '@/shared/lib/math';
import type { ChartLevel, NoteTuple, SectionTuple, SpellKind } from '@/shared/types/chart';
import { STEPS_PER_BAR, type SongAnalysis } from './SongAnalyzer';
import { PHRASE_BARS, clearHitsPerBar, decide, groupBars, phraseLevels, rng, round3, type Bar, type Event } from './bars';
import {
  BUDGETS,
  MAX_STARS,
  eventWeights,
  failsAt,
  foldBpm,
  gapSlots,
  rateStarsBudget,
  targetStars,
  windowPeak,
  type Budget,
  type Chapter,
  type SongEnergy,
} from './budget';
import { MIN_AUDIBLE, figureOf, gridBonus, shrinkFigure, stepDist, type Figure } from './figure';
import { assignLanes } from './laneAssign';
import { MELODIC_LAYERS, PRESENCE_REL, layerP90, presentLayers, ringAt, type Layer, type StemLayers } from './layers';
import { ROLL_MAX_TAPS, ROLL_MIN_TAPS, detectFill } from './phrasePattern';
import { eventsToTuples } from './stars';

/**
 * Chart composer: turns the analysed beat grid into ONE playable, musical chart per song.
 *
 * The song's ★ is chosen first (from its energy and the chapter) and everything is placed under
 * that budget (`budget.ts`): the smallest gap between tiles, the figure size, the events per bar,
 * the densest 1 / 4 / 8 seconds, the mechanics per phrase. Tiles sit only on audible hits — the
 * attack-gated maxima of the mix, or of an instrument that is really playing in the phrase — and
 * never below the ear's floor (a slot the mix and the stems both leave quiet). Every 4-bar phrase
 * has ONE figure (beats first, an eighth grid where the ★ allows it, one pickup pair at most)
 * repeated in every bar where it sounds; when the rolling windows still overflow, a whole step
 * leaves the phrase, never a random tile. Then the music adds the mechanics — rolls on real drum
 * streams, holds where an instrument rings at least a beat, slides, chords only at ★5–6, circle
 * windows at real drops, a spinner on a breakdown — each only while the windows hold. The rating
 * at the end is a check, not a readout: the chart is thinned until it fits its target, and the
 * same chart plays at ×1 / ×1.12 / ×1.2, so every limit was sized for ×1.2.
 */

/** A hit must start this abruptly (`Slot.attack`) to count; below it the sound is a swell, not a tap. */
const ATTACK_MIN = 0.35;
/** Below this mix strength a slot is silence unless a present stem clearly hits there (an onset maximum this strong, at real energy). */
const SILENCE = 0.05;
const SILENCE_STEM = 0.5;
/** The ear's floor for a tile: the mix reaches this, or a present stem clearly hits — anything placed below it is a "quiet tile" (§B). */
const QUIET_MIX = 0.3;
/** A phrase counts as intense for the song energy at this many clear hits per bar — absolute, unlike the relative phrase levels. */
const INTENSE_CLEAR_PER_BAR = 3;
/** Quiet phrases (an intro of soft stabs) are lifted so their clear peaks reach 0.5 — at most ×2.5, so pad noise stays below MIN_AUDIBLE. */
const BOOST_TARGET = 0.5;
const MAX_BOOST = 2.5;
/** A present stem's own onset counts as a hit of this strength next to the mix's; drum onsets (hi-hats the mix hides) a little less. */
const STEM_WEIGHT = 0.8;
const DRUM_WEIGHT = 0.6;
/** A bar sounds a figure step when its own audibility reaches this share of the phrase profile there. */
const SOUND_REL = 0.35;
/** Figure steps this loud (share of the profile max) are accents — chord candidates at ★5–6. */
const ACCENT_REL = 0.85;
/** Holds: a sound must ring at least a beat; a hold never exceeds a bar. */
const HOLD_MIN_SLOTS = 4;
const HOLD_MAX_SLOTS = 16;
/** A ringing instrument starts a note at an onset maximum at least this strong. */
const HOLD_ONSET = 0.3;
/** Without stems the mix must report a sustain this long, and the slot must not be bass-heavy. */
const HOLD_MIX_SUSTAIN = 6;
const HOLD_MIX_LOW = 0.55;
/** The other thumb taps at most this many figure tiles per beat under a hold. */
const HOLD_TAPS_PER_BEAT = 1;
/** A hold swallows only figure steps quieter than this share of the profile max. */
const HOLD_SWALLOW_REL = 0.5;
/** Legato phrases (this share of the figure rings ≥ a beat): long tiles are the honest reading — a third of the figure stays taps, 3 holds per bar. */
const LEGATO_SHARE = 0.6;
const HOLDS_PER_BAR = 2;
const HOLDS_PER_BAR_LEGATO = 3;
/** After a long note the thumb needs this long (song s) to lift and move — at least two slots. */
const RELEASE_SEC = 0.25;
/** A slide is exactly two beats long, from a hold that rings at least that. */
const SLIDE_SLOTS = 8;
const SLIDE_CHANCE = 0.3;
/** Rolls: taps per song-second (6/s real at ×1.2), at least 0.7 s long, on a drum stream — every eighth of the half bar at least ROLL_STREAM_SLOT, the four on average ROLL_STREAM_MIN. */
const ROLL_TAPS_PER_SEC = 5;
const ROLL_MIN_SEC = 0.7;
const ROLL_STREAM_MIN = 0.4;
const ROLL_STREAM_SLOT = 0.3;
/** A phrase-end stream needs the drums on all four eighths of the second half in this many of the phrase's bars. */
const ROLL_STREAM_BARS = 3;
/** Mid-phrase drum streams roll this often (bars), by policy. */
const ROLL_MID_EVERY_BARS = { normal: 8, many: PHRASE_BARS };
/** A chord needs two present instruments hitting at least this hard at the same slot. */
const CHORD_STEM = 0.6;
/** Circle windows: the first two bars of a real drop, at least this many bars apart. */
const CIRCLE_WINDOW_BARS = 2;
const CIRCLE_MIN_APART_BARS = 16;
/** Spinner: a breakdown of this many bars (bar energy ≤ SPIN_ENERGY_REL × the median bar, still audible). */
const SPIN_MIN_BARS = 2;
const SPIN_MAX_BARS = 4;
/** Empty field before a spinner starts (a beat) and after it ends (the notes' whole fall, 3.5 beats). */
const SPIN_GAP_BEFORE = 4;
const SPIN_GAP_AFTER = 14;
const SPIN_COOLDOWN_BARS = 24;
const SPIN_ENERGY_REL = 0.6;
const SPIN_AUDIBLE = 0.1;
/** Lane-count sections: 8-bar blocks, at least 16 bars each, an empty 0.6 s (≥ a beat) before a change — the field morph plus a hit window must fit. */
const SECTION_BARS = 8;
const SECTION_MIN_BARS = 16;
const SECTION_GAP_SEC = 0.6;
/** A spell note every this many bars, starting at bar 4 (after the intro); slow-motion only on the hardest charts. */
const SPELL_EVERY_BARS = 8;
const SLOW_FROM_STARS = 6;
/** Shrink and repair iterations: each removes a figure step (a plain tap) from the offending stretch. */
const MAX_SHRINK = 40;
const MAX_REPAIR = 40;
const EPS = 1e-9;

export type RollPolicy = 'none' | 'normal' | 'many';

export interface ComposeOptions {
  seed?: number;
  /** The chapter the song is published in — its ★ range (§B); default `'normal'` (custom songs, packs). */
  chapter?: Chapter;
  /** Per-instrument onsets and energies from separated stems: audible hits, ringing sounds, chords come from what really plays. */
  layers?: StemLayers;
  /** Per-track ★ override (`tracks.json` `chart.stars`), clamped to 1–6. */
  targetStars?: number;
  /** Roll policy (`tracks.json` `chart.rolls`): how often a mid-phrase drum stream rolls, or no rolls at all; default `'normal'`. */
  rolls?: RollPolicy;
  /** Reports what the composer decided (tooling / logs). */
  onTrace?: (trace: ComposeTrace) => void;
}

export interface ComposeTrace {
  target: number;
  energy: SongEnergy;
  levels: (0 | 1 | 2)[];
  /** Sorted figure steps per phrase, after shrinking. */
  figures: number[][];
  shrinks: number;
  repairs: number;
  /** The check: the smallest ★ the finished chart fits (the chart carries its target when it fits that), and why it misses its target when it does. */
  stars: number;
  fails: string[];
}

/**
 * The bar grid a chart is rated on — every grouped bar's first slot (a partial first bar included)
 * and the end of the last bar. The composer's check and `generate-charts`' gate must use the same
 * grid, or a chart can pass one and fail the other by a bar's shift of its phrases.
 */
export function chartBarTimes(analysis: SongAnalysis): number[] {
  const slots = analysis.slots;
  const bars = groupBars(slots);
  const last = slots.length - 1;
  const slotSec = slots.length > 1 ? (slots[last].time - slots[0].time) / last : 15 / analysis.bpm;
  const times = bars.map((b) => round3(b.slots[0].time));
  const endSlot = bars[bars.length - 1].start + bars[bars.length - 1].slots.length;
  times.push(round3(endSlot <= last ? slots[endSlot].time : slots[last].time + (endSlot - last) * slotSec));
  return times;
}

export function composeChart(analysis: SongAnalysis, opts: ComposeOptions = {}): ChartLevel {
  const seed = opts.seed ?? 1337;
  const chapter = opts.chapter ?? 'normal';
  const rollPolicy = opts.rolls ?? 'normal';
  const random = rng(seed);
  const slots = analysis.slots;
  const L = opts.layers;
  const empty: ChartLevel = { stars: 1, notes: [], sections: [[0, LANE_COUNT]] };
  if (slots.length < STEPS_PER_BAR) {
    opts.onTrace?.({
      target: 1,
      energy: { clearPerSec: 0, intenseShare: 0, bpmFolded: foldBpm(analysis.bpm) },
      levels: [],
      figures: [],
      shrinks: 0,
      repairs: 0,
      stars: 1,
      fails: [],
    });
    return empty;
  }
  const bars = groupBars(slots);
  const phrases: Bar[][] = [];
  for (let p = 0; p * PHRASE_BARS < bars.length; p++) phrases.push(bars.slice(p * PHRASE_BARS, (p + 1) * PHRASE_BARS));
  const phraseOf = (bar: Bar): number => Math.floor(bar.index / PHRASE_BARS);
  const phraseOfSlot = (si: number): number => Math.floor(slots[si].bar / PHRASE_BARS);
  const slotSec = percentile(
    slots.slice(1).map((s, i) => s.time - slots[i].time),
    0.5,
  );
  const last = slots.length - 1;
  const timeAt = (si: number): number => (si <= last ? slots[si].time : slots[last].time + (si - last) * slotSec);
  const barEnd = (bar: Bar): number => bar.start + bar.slots.length;
  const isPeak = (arr: ArrayLike<number>, i: number): boolean => arr[i] >= (arr[i - 1] ?? 0) && arr[i] >= (arr[i + 1] ?? 0);
  const releaseSlots = Math.max(2, Math.ceil(RELEASE_SEC / slotSec - EPS));
  const sectionGapSlots = Math.max(4, Math.ceil(SECTION_GAP_SEC / slotSec - EPS));

  // ---- Pass 1: audibility — what the ear hears at every slot ----
  const present: Set<Layer>[] = phrases.map((ph) => {
    if (!L) return new Set<Layer>();
    const idx: number[] = [];
    for (const b of ph) for (let k = 0; k < b.slots.length; k++) idx.push(b.start + k);
    return presentLayers(L, idx);
  });
  const p90 = L ? layerP90(L) : null;
  /**
   * The present stems hitting at `gi` (onset maxima): the strongest one's raw onset, its weight for `aud`
   * (drums a little less), and whether one hits clearly — at least SILENCE_STEM with real energy there.
   */
  const stemAt = (gi: number): { raw: number; weighted: number; clear: boolean } => {
    const hit = { raw: 0, weighted: 0, clear: false };
    if (!L || !p90) return hit;
    for (const l of present[phraseOfSlot(gi)]) {
      const o = L.onset[l];
      if (!isPeak(o, gi)) continue;
      hit.raw = Math.max(hit.raw, o[gi]);
      hit.weighted = Math.max(hit.weighted, (l === 'drums' ? DRUM_WEIGHT : STEM_WEIGHT) * o[gi]);
      if (o[gi] >= SILENCE_STEM && L.energy[l][gi] >= PRESENCE_REL * p90[l]) hit.clear = true;
    }
    return hit;
  };
  /** The ear's floor for a tile, attack or not: the mix reaches QUIET_MIX, or a present stem clearly hits. */
  const audibleAt = (gi: number): boolean => slots[gi].strength >= QUIET_MIX || stemAt(gi).clear;
  const aud = new Float32Array(slots.length);
  const audibility = (): void => {
    // The peak test is grid-weighted: when a stab and a kick light adjacent slots (an off-grid "ta" 40 ms
    // before the beat), the beat is the hit and the stab its shoulder — never the other way round.
    const strength = slots.map((s) => s.strength * (1 + gridBonus(s.step)));
    for (let gi = 0; gi < slots.length; gi++) {
      const s = slots[gi];
      if ((s.attack ?? 1) < ATTACK_MIN) continue;
      // De-smear: the analysis window lights two slots for one hit; only the louder one is the mix's hit,
      // the shoulder keeps half so a bar can still "sound" a step that peaks a slot away.
      const stem = stemAt(gi);
      aud[gi] = s.strength < SILENCE && !stem.clear ? 0 : Math.max(isPeak(strength, gi) ? s.strength : 0.5 * s.strength, stem.weighted);
    }
    // A mild phrase boost: a quiet intro whose peaks are real still gets its figure; pad noise (p90 < 0.2) gets nothing.
    for (const ph of phrases) {
      const peaks: number[] = [];
      for (const b of ph) for (let k = 0; k < b.slots.length; k++) if (aud[b.start + k] > 0 && isPeak(aud, b.start + k)) peaks.push(aud[b.start + k]);
      if (!peaks.length) continue;
      const loud = percentile(peaks, 0.9);
      if (loud < BOOST_TARGET / MAX_BOOST) continue;
      const factor = Math.min(MAX_BOOST, Math.max(1, BOOST_TARGET / loud));
      if (factor > 1) for (const b of ph) for (let k = 0; k < b.slots.length; k++) aud[b.start + k] = Math.min(1, aud[b.start + k] * factor);
    }
  };
  audibility();

  // ---- Pass 2: phrase levels and song energy ----
  const levels = phraseLevels(bars, aud);
  const energyOf = (): SongEnergy => {
    let clear = 0;
    for (let gi = 0; gi < slots.length; gi++) if (aud[gi] >= 0.5 && isPeak(aud, gi)) clear++;
    return {
      clearPerSec: clear / Math.max(1, analysis.duration),
      intenseShare: phrases.filter((ph) => clearHitsPerBar(ph, aud) >= INTENSE_CLEAR_PER_BAR).length / Math.max(1, phrases.length),
      bpmFolded: foldBpm(analysis.bpm),
    };
  };
  const energy = energyOf();
  /** A drop opens at phrase `p`: loud after a quieter phrase. Its first two bars may become a circle window — never at the song's first drop. */
  const dropStart = (p: number): boolean => p > 0 && levels[p] === 2 && levels[p - 1] <= 1;
  const firstDrop = phrases.findIndex((_, p) => dropStart(p));
  const circlePhrase = (p: number): boolean => dropStart(p) && p !== firstDrop;

  // ---- Pass 3: target ★ and its budget ----
  const target = targetStars(energy, chapter, opts.targetStars);
  const B: Budget = BUDGETS[target as 1 | 2 | 3 | 4 | 5 | 6];
  const Bq: Budget = BUDGETS[Math.max(1, target - 1) as 1 | 2 | 3 | 4 | 5 | 6];
  /** Quiet and medium phrases keep the wider grid of ★ and ★−1. */
  const gapFor = (level: number): number => (level === 2 ? gapSlots(B, slotSec) : Math.max(gapSlots(B, slotSec), gapSlots(Bq, slotSec)));
  const pair = B.pairMinSec > 0 ? { minSec: B.pairMinSec, slotSec } : null;

  // ---- Pass 4: the figure of every phrase ----
  const profiles = phrases.map((ph) => {
    const prof = new Array<number>(STEPS_PER_BAR).fill(0);
    const cnt = new Array<number>(STEPS_PER_BAR).fill(0);
    for (const b of ph)
      for (let k = 0; k < b.slots.length && k < STEPS_PER_BAR; k++) {
        prof[k] += aud[b.start + k];
        cnt[k]++;
      }
    return prof.map((v, k) => (cnt[k] ? v / cnt[k] : 0));
  });
  const figures: Figure[] = [];
  const figuresOf = (): void => {
    for (let p = 0; p < phrases.length; p++) {
      const prev = p > 0 && levels[p - 1] === levels[p] ? figures[p - 1] : undefined;
      figures.push(figureOf(profiles[p], B.steps[levels[p]], gapFor(levels[p]), pair, prev));
    }
  };
  figuresOf();
  /** The figure's pickup pair (two steps an eighth apart), if it has one. */
  const pairOf = (fig: Figure): [number, number] | null => {
    for (const a of fig.steps) for (const b of fig.steps) if (a < b && stepDist(a, b) === 2) return [a, b];
    return null;
  };
  /** A bar sounds a figure step where its audibility reaches the profile's share — and the slot is audible on its own: no tile below the ear's floor. */
  const sounds = (fig: Figure, bar: Bar, step: number): boolean =>
    step < bar.slots.length && aud[bar.start + step] >= Math.max(MIN_AUDIBLE, SOUND_REL * fig.profile[step]) && audibleAt(bar.start + step);
  const plain = (si: number, bar: Bar, step: number, fig: Figure): Event => ({
    si,
    bar,
    step,
    size: 1,
    hold: 0,
    kind: null,
    taps: 0,
    accent: fig.steps.includes(step) && fig.profile[step] >= ACCENT_REL * Math.max(...fig.profile),
    figure: fig.signature,
  });

  // ---- Pass 5: every bar repeats its phrase's figure where it sounds ----
  const placeBars = (): Event[] => {
    const out: Event[] = [];
    for (const bar of bars) {
      const p = phraseOf(bar);
      const fig = figures[p];
      const cap = B.maxPerBar[levels[p]];
      const pr = pairOf(fig);
      const isPair = (a: number, b: number): boolean => !!pr && pr.includes(a) && pr.includes(b);
      const minGap = (a: number, b: number): number => (isPair(a, b) ? B.pairMinSec : B.minGapSec);
      const placed: number[] = [];
      for (const step of fig.steps) {
        if (placed.length >= cap) break;
        if (!sounds(fig, bar, step)) continue;
        const si = bar.start + step;
        const t = timeAt(si);
        if (!placed.every((st) => Math.abs(t - timeAt(bar.start + st)) >= minGap(st, step) - EPS)) continue;
        // Cross-bar gap on actual times. A downbeat is never suppressed by the previous bar's last
        // step: that step yields instead (the pickup pair of the same figure may stay).
        let fits = true;
        for (let k = out.length - 1; k >= 0; k--) {
          const prev = out[k];
          const crossPair = prev.figure === fig.signature && isPair(prev.step, step);
          if (t - timeAt(prev.si) >= (crossPair ? B.pairMinSec : B.minGapSec) - EPS) break;
          if (step === 0 && prev.step > 0) {
            out.splice(k, 1);
            continue;
          }
          fits = false;
          break;
        }
        if (!fits) continue;
        placed.push(step);
      }
      placed.sort((a, b) => a - b);
      for (const step of placed) out.push(plain(bar.start + step, bar, step, fig));
    }
    return out;
  };
  let events = placeBars();

  // ---- The rolling windows of the budget, with the rating's own weights (tap 1, chord 1.5, roll 1, circle 1, spinner 0) ----
  const windows: readonly (readonly [number, number])[] = [
    [1, B.peak1s],
    [4, B.peak4s],
    [8, B.peak8s],
  ];
  const weightsOf = (evs: readonly Event[]) => eventWeights(eventsToTuples(evs, slots));
  const windowsHold = (evs: readonly Event[]): boolean => {
    const w = weightsOf(evs);
    return windows.every(([win, limit]) => windowPeak(w, win) <= limit + EPS);
  };
  /** The first window over the budget, as a time span. */
  const violating = (evs: readonly Event[]): { from: number; to: number } | null => {
    const w = weightsOf(evs);
    for (const [win, limit] of windows) {
      let j = 0;
      let sum = 0;
      for (let i = 0; i < w.length; i++) {
        sum += w[i].w;
        while (w[i].t - w[j].t >= win) sum -= w[j++].w;
        if (sum / win > limit + EPS) return { from: w[j].t, to: w[i].t };
      }
    }
    return null;
  };

  // ---- Pass 6: shrink — the phrase with the most events in an overflowing window loses a whole step ----
  let shrinks = 0;
  const shrink = (): void => {
    for (let iter = 0; iter < MAX_SHRINK; iter++) {
      const v = violating(events);
      if (!v) break;
      const count = new Map<number, number>();
      for (const e of events) {
        const t = round3(timeAt(e.si));
        if (t >= v.from && t <= v.to) count.set(phraseOf(e.bar), (count.get(phraseOf(e.bar)) ?? 0) + 1);
      }
      let worst = -1;
      for (const [p, n] of count)
        if (worst < 0 || n > count.get(worst)! || (n === count.get(worst) && figures[p].steps.length > figures[worst].steps.length)) worst = p;
      if (worst < 0 || !figures[worst].steps.length) break;
      figures[worst] = shrinkFigure(figures[worst]);
      events = placeBars();
      shrinks++;
    }
  };
  shrink();

  // ---- Pass 7: sections — a lane count per 8-bar block from the budget's pools, at least 16 bars per section ----
  const sections: SectionTuple[] = [];
  const lastBarOfSection = new Set<number>();
  const sectionsOf = (): void => {
    const blockLevel = (b0: number): 0 | 1 | 2 => {
      const ps = [Math.floor(b0 / PHRASE_BARS), Math.floor((b0 + PHRASE_BARS) / PHRASE_BARS)].filter((p) => p < levels.length);
      return Math.round(ps.reduce((a, p) => a + levels[p], 0) / Math.max(1, ps.length)) as 0 | 1 | 2;
    };
    // Quiet and medium blocks share one pool: a verse never re-shapes the field, only a drop does (and the
    // way back out of it), so the whole song is two or three sections, not one per level change.
    const calm = [...new Set([...B.lanes[0], ...B.lanes[1]])];
    const poolOf = (level: 0 | 1 | 2): readonly number[] => (level === 2 ? B.lanes[2] : calm);
    let prevLanes = LANE_COUNT;
    let sectionLevel: 0 | 1 | 2 = blockLevel(0);
    let sectionStart = 0;
    for (let b0 = 0; b0 < bars.length; b0 += SECTION_BARS) {
      const block = bars.slice(b0, b0 + SECTION_BARS);
      const level = blockLevel(b0);
      const pool = poolOf(level);
      let lanes = prevLanes;
      if (b0 === 0) lanes = pool.includes(LANE_COUNT) ? LANE_COUNT : pool[Math.floor(random() * pool.length)];
      // A new section needs a level change the current count cannot serve, a full block, a section
      // at least 16 bars old — and at least 16 bars left to play it.
      else if (
        level !== sectionLevel &&
        !pool.includes(prevLanes) &&
        block.length === SECTION_BARS &&
        b0 - sectionStart >= SECTION_MIN_BARS &&
        bars.length - b0 >= SECTION_MIN_BARS
      )
        lanes = pool[Math.floor(random() * pool.length)];
      if (b0 === 0 || lanes !== prevLanes) {
        sectionStart = b0;
        sectionLevel = level;
      }
      for (const b of block) b.lanes = lanes;
      if (!sections.length || sections[sections.length - 1][1] !== lanes) sections.push([sections.length ? round3(block[0].slots[0].time) : 0, lanes]);
      prevLanes = lanes;
    }
    for (let i = 0; i + 1 < bars.length; i++) if (bars[i + 1].lanes !== bars[i].lanes) lastBarOfSection.add(bars[i].index);
    events = events.filter((ev) => !(lastBarOfSection.has(ev.bar.index) && ev.step >= STEPS_PER_BAR - sectionGapSlots));
  };
  sectionsOf();

  // ---- Pass 8: mechanics, each under its cap and only while the windows hold ----
  /** How long the sound starting at `si` rings, in slots: a present melodic stem's energy-only ring after its onset maximum; from the mix, its sustain. */
  const ringOf = (si: number): number => {
    if (!L || !p90) {
      const s = slots[si];
      return s.sustain >= HOLD_MIX_SUSTAIN && s.low < HOLD_MIX_LOW ? s.sustain : 0;
    }
    let best = 0;
    for (const l of MELODIC_LAYERS) {
      if (!present[phraseOfSlot(si)].has(l)) continue;
      const o = L.onset[l];
      if (o[si] < HOLD_ONSET || !isPeak(o, si)) continue;
      best = Math.max(best, ringAt(L, l, si, p90));
    }
    return best;
  };
  const drumOnset = (gi: number): number => (L && present[phraseOfSlot(gi)].has('drums') ? L.onset.drums[gi] : L ? 0 : slots[gi].strength);
  const isLong = (e: Event): boolean => e.hold > 0;
  /** Cut a long note so that it ends a release before `si`; too short → a plain tap. */
  const endBefore = (e: Event, si: number): void => {
    if (!isLong(e) || e.kind === 'spin' || e.si + e.hold + releaseSlots <= si) return;
    e.hold = si - releaseSlots - e.si;
    if (e.hold < HOLD_MIN_SLOTS || e.kind === 'roll') {
      e.hold = 0;
      e.taps = 0;
      if (e.kind === 'roll' || e.kind === 'slide') e.kind = null;
    } else if (e.kind === 'slide' && e.hold < SLIDE_SLOTS) e.kind = null;
  };
  /** Empty the field on [from, to): notes inside go, long notes reaching in are cut short — except a roll that ends by `keepRollUntil`. */
  const clearWindow = (from: number, to: number, keepRollUntil = -1): void => {
    events = events.filter((e) => e.si < from || e.si >= to);
    for (const e of events) if (e.si < from && !(e.kind === 'roll' && e.si + e.hold <= keepRollUntil)) endBefore(e, from);
  };
  const barTapCount = (bar: Bar): number => events.filter((e) => e.bar === bar && !e.kind && !isLong(e)).length;

  // 8a. Rolls (★4+): a drum stream over a bar's second half — at every phrase end, mid-phrase by policy, or a drum fill.
  //     Rolls go first: they claim their half-bars, and the holds are then placed around them (a hold placed
  //     first would only be cut or dropped by the roll, together with the holds it had kept out).
  const rolls = (): void => {
    const perPhrase = rollPolicy === 'none' ? 0 : L ? B.rollsPerPhrase : Math.min(1, B.rollsPerPhrase);
    if (perPhrase <= 0) return;
    const used = new Map<number, number>();
    const STREAM = [8, 10, 12, 14];
    const streams = (bar: Bar): boolean => {
      if (bar.slots.length !== STEPS_PER_BAR) return false;
      const v = STREAM.map((k) => drumOnset(bar.start + k));
      return v.every((x) => x >= ROLL_STREAM_SLOT) && v.reduce((a, x) => a + x, 0) / v.length >= ROLL_STREAM_MIN;
    };
    const tryRoll = (bar: Bar, from: number, taps: number): boolean => {
      const p = phraseOf(bar);
      if ((used.get(p) ?? 0) >= perPhrase || lastBarOfSection.has(bar.index)) return false;
      const si = bar.start + from;
      const dur = timeAt(barEnd(bar)) - timeAt(si);
      if (dur < ROLL_MIN_SEC) return false;
      const n = Math.min(taps, ROLL_MAX_TAPS, Math.floor(dur * ROLL_TAPS_PER_SEC));
      if (n < ROLL_MIN_TAPS) return false;
      // The roll replaces the figure taps it covers (a silent half-bar stays silent) and gets an eighth of air before
      // its head; the holds placed after it end a release before the head and start none before its thumb is free.
      const covered = events.filter((e) => e.si >= si && e.si < barEnd(bar));
      if (!covered.length) return false;
      const fig = figures[p];
      const roll: Event = { ...plain(si, bar, from, fig), hold: barEnd(bar) - si, kind: 'roll', taps: n, accent: false };
      events = events.filter((e) => !(e.si >= si - 2 && e.si < barEnd(bar)));
      events.push(roll);
      events.sort((a, b) => a.si - b.si);
      used.set(p, (used.get(p) ?? 0) + 1);
      return true;
    };
    phrases.forEach((ph, p) => {
      const lastBar = ph[ph.length - 1];
      // (a) A phrase-end stream: the drums play all four eighths of the second half in most of the phrase's bars.
      if (ph.filter(streams).length >= Math.min(ROLL_STREAM_BARS, ph.length) && streams(lastBar)) tryRoll(lastBar, 8, ROLL_MAX_TAPS);
      // (b) A mid-phrase drum stream, by policy: one of the phrase's other bars every 4 bars ('many'), the
      //     second bar every 8 bars in loud phrases ('normal'). Where a circle window may open, the phrase's
      //     first two bars belong to the circles, so the third bar is tried first.
      if (L && ph.length === PHRASE_BARS) {
        const mids =
          rollPolicy === 'many'
            ? circlePhrase(p)
              ? [ph[2], ph[1], ph[0]]
              : [ph[1], ph[2], ph[0]]
            : ph[0].index % ROLL_MID_EVERY_BARS.normal === 0 && levels[p] === 2
              ? [circlePhrase(p) ? ph[2] : ph[1]]
              : [];
        const mid = mids.find(streams);
        if (mid) tryRoll(mid, 8, ROLL_MAX_TAPS);
      }
      // (c) A drum fill of two beats on the fine grid.
      if (L)
        for (const bar of ph)
          if (!events.some((e) => e.bar === bar && e.kind === 'roll')) {
            const fill = present[p].has('drums') ? detectFill(L.onset.drums, bar.start, barEnd(bar)) : null;
            if (fill) tryRoll(bar, fill.from, fill.taps);
          }
    });
  };
  rolls();

  // 8b. Holds: per phrase, the figure steps that ring longest hold — the same step in every bar; where the
  //     instrument lands elsewhere in a bar (a pad that rings from beat 4 here and beat 12 there), that bar's
  //     own longest-ringing figure step may hold instead.
  const holds = (): void => {
    events.sort((a, b) => a.si - b.si);
    const holdSteps: number[][] = [];
    const legato: boolean[] = [];
    const minTaps: number[] = [];
    phrases.forEach((ph, p) => {
      const fig = figures[p];
      const ring = new Map<number, number>();
      for (const k of fig.steps) {
        const rs: number[] = [];
        for (const e of events) if (e.bar.index >= ph[0].index && e.bar.index <= ph[ph.length - 1].index && e.step === k && !e.kind) rs.push(ringOf(e.si));
        if (rs.length) ring.set(k, percentile(rs, 0.5));
      }
      const ringing = fig.steps.filter((k) => (ring.get(k) ?? 0) >= HOLD_MIN_SLOTS);
      ringing.sort((a, b) => ring.get(b)! - ring.get(a)! || a - b);
      const isLegato = fig.steps.length > 0 && ringing.length >= LEGATO_SHARE * fig.steps.length;
      holdSteps.push(ringing);
      legato.push(isLegato);
      minTaps.push(fig.steps.length < 2 ? 0 : Math.ceil(fig.steps.length / (isLegato ? 3 : 2)));
    });
    /** The figure step that rings longest in each bar (at least a beat). */
    const longestInBar = new Map<number, number>();
    for (const e of events) {
      if (e.kind || !figures[phraseOf(e.bar)].steps.includes(e.step)) continue;
      const r = ringOf(e.si);
      const cur = longestInBar.get(e.bar.index);
      if (r >= HOLD_MIN_SLOTS && (cur === undefined || r > ringOf(cur))) longestInBar.set(e.bar.index, e.si);
    }
    const max = phrases.map((_, p) => Math.max(...figures[p].profile));
    const weak = (e: Event): boolean => figures[phraseOf(e.bar)].profile[e.step] < HOLD_SWALLOW_REL * max[phraseOf(e.bar)];
    const usedPhrase = new Map<number, number>();
    const usedBar = new Map<number, number>();
    const swallowed = new Set<Event>();
    let active: Event | null = null;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (swallowed.has(ev)) continue;
      if (active && ev.si >= active.si + active.hold + releaseSlots) active = null;
      if (isLong(ev)) {
        active = ev;
        continue;
      }
      if (active || ev.kind) continue;
      const p = phraseOf(ev.bar);
      if (!holdSteps[p].includes(ev.step) && longestInBar.get(ev.bar.index) !== ev.si) continue;
      const perBar = legato[p] ? HOLDS_PER_BAR_LEGATO : HOLDS_PER_BAR;
      const perPhrase = legato[p] ? HOLDS_PER_BAR_LEGATO * phrases[p].length : B.holdsPerPhrase;
      if ((usedBar.get(ev.bar.index) ?? 0) >= perBar || (usedPhrase.get(p) ?? 0) >= perPhrase) continue;
      const ring = ringOf(ev.si);
      if (ring < HOLD_MIN_SLOTS) continue;
      let dur = Math.min(ring, HOLD_MAX_SLOTS, barEnd(ev.bar) + 4 - ev.si);
      if (lastBarOfSection.has(ev.bar.index)) dur = Math.min(dur, barEnd(ev.bar) - sectionGapSlots - ev.si);
      else if (lastBarOfSection.has(ev.bar.index + 1)) dur = Math.min(dur, barEnd(ev.bar) + STEPS_PER_BAR - sectionGapSlots - ev.si);
      // One long note at a time: the hold ends a release before the next long note, chord or circle.
      for (let j = i + 1; j < events.length && events[j].si < ev.si + dur + releaseSlots; j++)
        if (isLong(events[j]) || events[j].size > 1 || events[j].kind === 'circle' || events[j].kind === 'spin')
          dur = Math.min(dur, events[j].si - releaseSlots - ev.si);
      // The other thumb keeps at most one figure tap per beat under the hold; weak steps of this bar are swallowed
      // while at least half the figure (a third in legato phrases) stays taps. Shorten by beats until that holds.
      let eat: Event[] = [];
      for (; dur >= HOLD_MIN_SLOTS; dur -= 4) {
        const under = events.filter((e) => !swallowed.has(e) && e !== ev && e.si > ev.si && e.si < ev.si + dur && e.kind !== 'circle');
        let taps = barTapCount(ev.bar) - 1 - [...swallowed].filter((e) => e.bar === ev.bar).length;
        eat = [];
        for (const e of under) {
          if (e.bar !== ev.bar || !weak(e) || isLong(e) || e.kind) continue;
          if (taps - 1 < minTaps[p]) break;
          eat.push(e);
          taps--;
        }
        if (under.length - eat.length <= Math.floor(dur / 4) * HOLD_TAPS_PER_BEAT) break;
      }
      if (dur < HOLD_MIN_SLOTS) continue;
      for (const e of eat) swallowed.add(e);
      ev.hold = dur;
      active = ev;
      usedBar.set(ev.bar.index, (usedBar.get(ev.bar.index) ?? 0) + 1);
      usedPhrase.set(p, (usedPhrase.get(p) ?? 0) + 1);
    }
    events = events.filter((e) => !swallowed.has(e));
    // Pad-only bars (an intro, a breakdown with nothing to tap): one hold per bar from the pad's own attack —
    // the slot where it is audible (the ear's floor, no attack gate: a pad swells in) and rings a beat or
    // more, beats first. A bar where the pad never clearly starts a note stays empty.
    const hasEvents = new Set(events.map((e) => e.bar));
    for (const bar of bars) {
      if (hasEvents.has(bar) || figures[phraseOf(bar)].steps.length || lastBarOfSection.has(bar.index)) continue;
      let head = -1;
      let best = -Infinity;
      for (let k = 0; k + HOLD_MIN_SLOTS + releaseSlots <= bar.slots.length; k++) {
        const si = bar.start + k;
        if (!audibleAt(si) || ringOf(si) < HOLD_MIN_SLOTS) continue;
        const score = Math.max(slots[si].strength, stemAt(si).raw) + gridBonus(k);
        if (score > best) {
          best = score;
          head = k;
        }
      }
      if (head < 0) continue;
      const fig = figures[phraseOf(bar)];
      const ev = plain(bar.start + head, bar, head, fig);
      ev.hold = Math.min(ringOf(ev.si), HOLD_MAX_SLOTS - releaseSlots, bar.slots.length - releaseSlots - head);
      const trial = [...events, ev].sort((a, b) => a.si - b.si);
      if (!windowsHold(trial)) continue;
      events = trial;
    }
    events.sort((a, b) => a.si - b.si);
  };
  holds();

  // 8c. Slides (★3+): a hold of at least two beats becomes a two-beat slide. The hold already keeps the other
  //     long notes a release away and admits at most one other-thumb tap per beat under it, which a slide
  //     (the same thumb, a neighbour lane) carries just as well.
  const slides = (): void => {
    if (B.slidesPerPhrase <= 0) return;
    const used = new Map<number, number>();
    for (const ev of events) {
      if (!isLong(ev) || ev.kind || ev.hold < SLIDE_SLOTS || ev.bar.lanes < 3) continue;
      const p = phraseOf(ev.bar);
      if ((used.get(p) ?? 0) >= B.slidesPerPhrase) continue;
      if (decide(seed, p, ev.step, 3) >= SLIDE_CHANCE) continue;
      ev.kind = 'slide';
      ev.hold = SLIDE_SLOTS;
      used.set(p, (used.get(p) ?? 0) + 1);
    }
  };
  slides();

  // 8d. Chords (★5–6): an accent on a beat where two present instruments hit, an eighth of air on both sides, nothing held, not in the first phrase.
  const chords = (): void => {
    if (B.chordsPerBar <= 0 || !L) return;
    const perBar = new Map<number, number>();
    const perPhrase = new Map<number, number>();
    let active: Event | null = null;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (active && ev.si >= active.si + active.hold + releaseSlots) active = null;
      if (isLong(ev)) {
        active = ev;
        continue;
      }
      if (active || ev.kind || !ev.accent || ev.step % 4 !== 0 || ev.bar.lanes < 3) continue;
      const p = phraseOf(ev.bar);
      if (p === 0 || (perBar.get(ev.bar.index) ?? 0) >= B.chordsPerBar || (perPhrase.get(p) ?? 0) >= B.chordsPerPhrase) continue;
      const prevGap = i > 0 ? ev.si - events[i - 1].si : Infinity;
      const nextGap = i + 1 < events.length ? events[i + 1].si - ev.si : Infinity;
      if (prevGap < 2 || nextGap < 2) continue;
      if ([...present[p]].filter((l) => L.onset[l][ev.si] >= CHORD_STEM).length < 2) continue;
      ev.size = 2;
      if (!windowsHold(events)) {
        ev.size = 1;
        continue;
      }
      perBar.set(ev.bar.index, (perBar.get(ev.bar.index) ?? 0) + 1);
      perPhrase.set(p, (perPhrase.get(p) ?? 0) + 1);
    }
  };
  chords();

  // 8e. Circle windows (★2+, never in chapter one): the first two bars of a loud phrase after a quieter one — a real drop, never the song's
  //     first — become circles only, on the figure's beat steps, a beat apart.
  const circleWindows = (): void => {
    if (B.circleWindows <= 0 || chapter === 'easy') return;
    let windows = 0;
    let lastStart = -100;
    for (let p = 1; p < phrases.length && windows < B.circleWindows; p++) {
      if (!circlePhrase(p)) continue;
      const wb = phrases[p].slice(0, CIRCLE_WINDOW_BARS);
      const fig = figures[p];
      if (wb.length < CIRCLE_WINDOW_BARS || wb[0].index < lastStart + CIRCLE_MIN_APART_BARS || !fig.steps.length) continue;
      if (wb.some((b) => lastBarOfSection.has(b.index))) continue;
      const circles: Event[] = [];
      for (const b of wb) {
        const beats = fig.steps.filter((k) => k % 4 === 0 && sounds(fig, b, k)).slice(0, B.circlesPerBar);
        for (const k of beats) circles.push({ ...plain(b.start + k, b, k, fig), kind: 'circle', accent: false });
      }
      if (circles.length < 2) continue;
      const before = events;
      // A roll ending at the window start stays (it leads into the drop); no circle while its thumb is still releasing.
      clearWindow(wb[0].start - 4, barEnd(wb[1]), wb[0].start);
      const busyUntil = Math.max(-1, ...events.filter((e) => e.kind === 'roll' && e.si < wb[0].start).map((e) => e.si + e.hold + releaseSlots));
      const trial = [...events, ...circles.filter((c) => c.si >= busyUntil)].sort((a, b) => a.si - b.si);
      if (!windowsHold(trial)) {
        events = before;
        continue;
      }
      events = trial;
      windows++;
      lastStart = wb[0].index;
    }
  };
  circleWindows();

  // 8f. Spinners (★3+): a breakdown — a quiet run after louder bars whose energy really drops, still audible — or the ending.
  const spinners = (): void => {
    if (B.spinners <= 0) return;
    const medianEnergy = percentile(
      bars.map((b) => b.energy),
      0.5,
    );
    const audible = (b: Bar): boolean => b.slots.some((s) => s.strength >= SPIN_AUDIBLE);
    const dropped = (b: Bar): boolean => b.energy <= SPIN_ENERGY_REL * medianEnergy;
    let spins = 0;
    let lastEnd = -100;
    for (let i = PHRASE_BARS; i < bars.length && spins < B.spinners; i++) {
      if (i < lastEnd + SPIN_COOLDOWN_BARS) continue;
      const breakdown = bars[i].level === 0 && dropped(bars[i]) && (bars[i - 1].level > 0 || !dropped(bars[i - 1]));
      const ending = i >= bars.length - SPIN_MAX_BARS && bars[i - 1].level > bars[i].level && bars.slice(i).every((b) => b.level <= 1);
      if (!breakdown && !ending) continue;
      const maxLevel = ending ? 1 : 0;
      const run: Bar[] = [];
      for (let k = i; k < bars.length && run.length < SPIN_MAX_BARS; k++) {
        const b = bars[k];
        if (b.level > maxLevel || !audible(b) || (!ending && !dropped(b)) || (k > i && lastBarOfSection.has(b.index - 1))) break;
        run.push(b);
        if (lastBarOfSection.has(b.index)) break;
      }
      if (run.length < SPIN_MIN_BARS) continue;
      const startSi = run[0].start;
      const endSi = barEnd(run[run.length - 1]) - SPIN_GAP_AFTER;
      if (endSi - startSi < STEPS_PER_BAR) continue;
      clearWindow(startSi - SPIN_GAP_BEFORE, endSi + SPIN_GAP_AFTER);
      events.push({ ...plain(startSi, run[0], 0, figures[phraseOf(run[0])]), hold: endSi - startSi, kind: 'spin', accent: false });
      events.sort((a, b) => a.si - b.si);
      lastEnd = run[run.length - 1].index;
      spins++;
    }
  };
  spinners();

  // 8g. Spells: the first plain tap of bars 4, 12, 20 … carries a heart; the hardest charts alternate with slow-motion.
  const spells = (): void => {
    const kinds: readonly SpellKind[] = target >= SLOW_FROM_STARS ? ['slow', 'heart'] : ['heart'];
    let n = 0;
    for (let b = 4; b < bars.length; b += SPELL_EVERY_BARS) {
      const ev = events.find((e) => (e.bar.index === b || e.bar.index === b + 1) && !e.kind && !isLong(e) && e.size === 1);
      if (ev) ev.kind = kinds[n++ % kinds.length];
    }
  };
  spells();

  // ---- Pass 9: lanes ----
  let notes = assignLanes(events, slots, random, releaseSlots);

  // ---- Pass 10: the rating is a check. When a mechanic pushed a feature over the target, the least
  //      audible plain tap in the offending stretch goes, until the chart fits. ----
  const barTimes = chartBarTimes(analysis);
  const audAt = new Map<number, number>();
  for (let gi = 0; gi < slots.length; gi++) audAt.set(round3(slots[gi].time), aud[gi]);
  let rating = rateStarsBudget(notes, analysis.bpm, sections, barTimes);
  let repairs = 0;
  const check = (): void => {
    while (rating.stars > target && repairs < MAX_REPAIR) {
      const times = [...new Set(notes.filter((n) => n[3] !== 'spin').map((n) => n[0]))].sort((a, b) => a - b);
      let region: [number, number] | null = null;
      const minGap = B.pairMinSec || B.minGapSec;
      for (let i = 2; i < times.length && !region; i++)
        if (times[i] - times[i - 1] < B.minGapSec - EPS && times[i - 1] - times[i - 2] < B.minGapSec - EPS) region = [times[i - 2], times[i]];
      for (let i = 1; i < times.length && !region; i++) if (times[i] - times[i - 1] < minGap - EPS) region = [times[i - 1], times[i]];
      if (!region) {
        // A density window (or a full bar): the densest 4 s.
        let best = 0;
        let at = 0;
        let j = 0;
        for (let i = 0; i < times.length; i++) {
          while (times[i] - times[j] >= 4) j++;
          if (i - j + 1 > best) {
            best = i - j + 1;
            at = times[j];
          }
        }
        region = [at, at + 4];
      }
      const [from, to] = region;
      const candidates = notes.filter((n) => n.length === 2 && n[0] >= from && n[0] <= to);
      if (!candidates.length) break;
      candidates.sort((a, b) => (audAt.get(a[0]) ?? 0) - (audAt.get(b[0]) ?? 0) || a[0] - b[0]);
      const gone: NoteTuple = candidates[0];
      notes = notes.filter((n) => n !== gone);
      repairs++;
      rating = rateStarsBudget(notes, analysis.bpm, sections, barTimes);
    }
  };
  check();
  // The chart's ★ is the target it was composed under whenever it fits that budget — a calm ★4 song
  // that also fits ★3 is still the ★4 chart the chapter asked for; only a chart the repair could not
  // bring under its target carries the honest higher rating.
  const fails = failsAt(rating.features, target);
  const stars = fails.length ? Math.min(MAX_STARS, rating.stars) : target;
  opts.onTrace?.({
    target,
    energy,
    levels,
    figures: figures.map((f) => [...f.steps].sort((a, b) => a - b)),
    shrinks,
    repairs,
    stars: rating.stars,
    fails,
  });
  return { stars, notes, sections };
}
