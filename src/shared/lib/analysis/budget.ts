/**
 * Difficulty budgets ★1–6: what a good chart may ask of two thumbs, per star.
 *
 * Every number is in SONG seconds. The game replays the same chart at ×1 / ×1.12 / ×1.2, so each
 * limit was chosen from its ×1.2 REAL value (in the comments) — the fastest level is the one the
 * budget protects, and what passes at ×1 must pass at ×1.2. The composer picks the song's ★ first
 * and fills the chart under `BUDGETS[★]`; `rateStarsBudget` then only checks which budget the
 * finished chart fits, so the printed ★ is honest and never above `MAX_STARS`.
 */
import type { NoteTuple, SectionTuple } from '@/shared/types/chart';

export const MAX_STARS = 6;
/** The fastest level's rate (`LEVEL_RATES[2]` in the play feature — duplicated so the engine stays dependency-free). */
export const FAST_RATE = 1.2;

export interface Budget {
  /** Smallest gap between any two events (song s): ★6 0.19 → 158 ms real at ×1.2 (the Good window is ±150). */
  minGapSec: number;
  /** An isolated pickup pair ("ta-KA": two tiles a beat of air on both sides) may be this close (song s); 0 = no pairs. */
  pairMinSec: number;
  /** Figure size: pattern steps per bar by phrase level [quiet, medium, loud]. */
  steps: readonly [number, number, number];
  /** Events per bar by phrase level [quiet, medium, loud]. */
  maxPerBar: readonly [number, number, number];
  /** Rolling windows, weighted events/s (song): any 1 s, any 4 s, any 8 s — the 8 s window is the one a level is lost in. */
  peak1s: number;
  peak4s: number;
  peak8s: number;
  /** Mean events/s over the active span — a soft target (§F), reported but never a reason to fail. */
  meanNps: number;
  /** Lane-count pools by phrase level [quiet, medium, loud]; never 2 or 6. */
  lanes: readonly [readonly number[], readonly number[], readonly number[]];
  /** Mechanics per 4-bar phrase. */
  holdsPerPhrase: number;
  slidesPerPhrase: number;
  rollsPerPhrase: number;
  /** Chords (a 2-heart stumble): per bar and per 4-bar phrase; 0 below ★5. */
  chordsPerBar: number;
  chordsPerPhrase: number;
  /** Circle windows per song (2 bars each, at a loud phrase start) and circles per bar inside one; 0 = none. */
  circleWindows: number;
  circlesPerBar: number;
  /** Spinners per chart (breakdowns become a wheel to circle); 0 for beginners. */
  spinners: number;
}

/** Real-time equivalents at ×1.2 are in the comments; the peaks are what the worst 8 s of a chart may ask. */
export const BUDGETS: Record<1 | 2 | 3 | 4 | 5 | 6, Budget> = {
  // ★1: gap 333 ms real, 1.9 ev/s real in the worst 8 s — beats only, two or three tiles per bar.
  1: {
    minGapSec: 0.4,
    pairMinSec: 0,
    steps: [2, 3, 3],
    maxPerBar: [2, 3, 3],
    peak1s: 2.5,
    peak4s: 1.8,
    peak8s: 1.6,
    meanNps: 1.2,
    lanes: [[3], [3], [4]],
    holdsPerPhrase: 2,
    slidesPerPhrase: 0,
    rollsPerPhrase: 0,
    chordsPerBar: 0,
    chordsPerPhrase: 0,
    circleWindows: 0,
    circlesPerBar: 0,
    spinners: 0,
  },
  // ★2: gap 300 ms real, 2.4 ev/s real; one circle window, still no other mechanics.
  2: {
    minGapSec: 0.36,
    pairMinSec: 0,
    steps: [2, 3, 4],
    maxPerBar: [2, 3, 4],
    peak1s: 3,
    peak4s: 2.2,
    peak8s: 2,
    meanNps: 1.5,
    lanes: [[3], [3, 4], [4]],
    holdsPerPhrase: 3,
    slidesPerPhrase: 0,
    rollsPerPhrase: 0,
    chordsPerBar: 0,
    chordsPerPhrase: 0,
    circleWindows: 1,
    circlesPerBar: 2,
    spinners: 0,
  },
  // ★3: gap 250 ms real (pickup pair 192 ms), 2.8 ev/s real; slides and a spinner appear.
  3: {
    minGapSec: 0.3,
    pairMinSec: 0.23,
    steps: [2, 4, 4],
    maxPerBar: [2, 4, 4],
    peak1s: 3,
    peak4s: 2.5,
    peak8s: 2.3,
    meanNps: 1.8,
    lanes: [[3], [4], [4]],
    holdsPerPhrase: 3,
    slidesPerPhrase: 1,
    rollsPerPhrase: 0,
    chordsPerBar: 0,
    chordsPerPhrase: 0,
    circleWindows: 2,
    circlesPerBar: 3,
    spinners: 1,
  },
  // ★4: gap 217 ms real (pair 183 ms), 3.1 ev/s real; a roll per phrase, five lanes in loud phrases.
  4: {
    minGapSec: 0.26,
    pairMinSec: 0.22,
    steps: [3, 4, 5],
    maxPerBar: [3, 4, 5],
    peak1s: 3.5,
    peak4s: 2.8,
    peak8s: 2.6,
    meanNps: 2.1,
    lanes: [[3], [4], [4, 5]],
    holdsPerPhrase: 4,
    slidesPerPhrase: 1,
    rollsPerPhrase: 1,
    chordsPerBar: 0,
    chordsPerPhrase: 0,
    circleWindows: 3,
    circlesPerBar: 4,
    spinners: 1,
  },
  // ★5: gap 175 ms real (pair 167 ms), 3.6 ev/s real; chords arrive (one per bar, two per phrase).
  5: {
    minGapSec: 0.21,
    pairMinSec: 0.2,
    steps: [3, 5, 6],
    maxPerBar: [3, 5, 6],
    peak1s: 4,
    peak4s: 3.2,
    peak8s: 3,
    meanNps: 2.5,
    lanes: [[4], [4, 5], [5]],
    holdsPerPhrase: 6,
    slidesPerPhrase: 1,
    rollsPerPhrase: 2,
    chordsPerBar: 1,
    chordsPerPhrase: 2,
    circleWindows: 3,
    circlesPerBar: 4,
    spinners: 2,
  },
  // ★6: gap 158 ms real (pair 150 ms — the Good window), 4.0 ev/s real in the worst 8 s; the ceiling.
  6: {
    minGapSec: 0.19,
    pairMinSec: 0.18,
    steps: [4, 6, 7],
    maxPerBar: [4, 6, 7],
    peak1s: 4.5,
    peak4s: 3.6,
    peak8s: 3.3,
    meanNps: 2.8,
    lanes: [[4], [4, 5], [5]],
    holdsPerPhrase: 8,
    slidesPerPhrase: 2,
    rollsPerPhrase: 2,
    chordsPerBar: 1,
    chordsPerPhrase: 2,
    circleWindows: 3,
    circlesPerBar: 4,
    spinners: 2,
  },
};

/** The budget of a ★, clamped into 1–6 (a chart rated 7 = "fits nothing" is checked against ★6). */
export function budgetOf(stars: number): Budget {
  return BUDGETS[Math.max(1, Math.min(MAX_STARS, Math.round(stars))) as 1 | 2 | 3 | 4 | 5 | 6];
}

/** Chapter caps: chapter one ★1–2, chapter two ★3–4, the rest (and the rock pack) ★2–6. */
export type Chapter = 'easy' | 'medium' | 'normal';
export const CHAPTER_RANGE: Record<Chapter, readonly [number, number]> = { easy: [1, 2], medium: [3, 4], normal: [2, 6] };

/**
 * The figure's grid gap in sixteenth slots: the smallest EVEN number of slots that is at least
 * `minGapSec` long (2 → eighths, 4 → beats). Sixteenth pairs do not exist at any ★.
 */
export function gapSlots(b: Budget, slotSec: number): number {
  let g = 2;
  while (g * slotSec < b.minGapSec - 1e-9) g += 2;
  return g;
}

/** What the song offers: measured on the analysis, before any chart exists. */
export interface SongEnergy {
  /** Attack-gated local peaks of audibility ≥ 0.5 per second. */
  clearPerSec: number;
  /** Share of 4-bar phrases with at least three clear hits per bar (an absolute measure: every song has a relative "loud" part). */
  intenseShare: number;
  /** Tempo folded into 70–165 (see `foldBpm`). */
  bpmFolded: number;
}

/** Tempo folded into 70–165 BPM: a doubled or halved grid does not change the felt tempo. */
export function foldBpm(bpm: number): number {
  let b = bpm;
  while (b >= 165) b /= 2;
  while (b < 70) b *= 2;
  return b;
}

/**
 * Song energy 0..1 from the song alone: clear hits per second (how much there is to tap), the
 * share of loud phrases (how much of the song is a drop), the felt tempo.
 */
export function songEnergy(e: SongEnergy): number {
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  return 0.5 * clamp01((e.clearPerSec - 1) / 3.5) + 0.25 * e.intenseShare + 0.25 * clamp01((e.bpmFolded - 95) / 60);
}

/**
 * Target ★ of a song: calm → ★2, drop-heavy → ★5–6, clamped by the chapter (chapter one ★1–2,
 * chapter two ★3–4). A per-track `override` (tracks.json `chart.stars`) wins, clamped to 1–6.
 */
export function targetStars(e: SongEnergy, chapter: Chapter, override?: number): number {
  if (override !== undefined) return Math.max(1, Math.min(MAX_STARS, Math.round(override)));
  const energy = songEnergy(e);
  if (chapter === 'easy') return energy < 0.3 ? 1 : 2;
  const raw = Math.floor(2 + 4.5 * energy + 0.4);
  const [lo, hi] = CHAPTER_RANGE[chapter];
  return Math.max(lo, Math.min(hi, raw));
}

/** The measurable ingredients of felt difficulty, on a finished chart, in song seconds. */
export interface BudgetFeatures {
  /** Weighted events per second over the active span (first event → last event). */
  meanNps: number;
  /** Densest 1 / 4 / 8-second windows, weighted events per second. */
  peak1s: number;
  peak4s: number;
  peak8s: number;
  /** Smallest gap between consecutive events (actual times, beat jitter included). */
  minGapSec: number;
  /** Consecutive event gaps in time order — `failsAt` reads the pair-isolation rule off them per ★. */
  gaps: readonly number[];
  /** Share of consecutive gaps ≤ 1.25 × an eighth — a readout for the log, no budget caps it. */
  eighthShare: number;
  /** Share of consecutive gaps ≤ 1.25 × a sixteenth. */
  sixteenthShare: number;
  /** Most events in one bar (a chord is one event); 0 without bar times. */
  maxPerBar: number;
  maxLanes: number;
  /** Chords in the busiest bar / 4-bar phrase; 0 without bar times. */
  chordsPerBarMax: number;
  chordsPerPhraseMax: number;
  /** Circles in the busiest bar, and how many circle windows the song has. */
  circlesPerBarMax: number;
  circleWindows: number;
  /** Rolls and slides in the busiest 4-bar phrase (0 without bar times), spinners in the song — the mechanics a ★ admits pin its rating. */
  rollsPerPhraseMax: number;
  slidesPerPhraseMax: number;
  spinners: number;
  /** Smallest gap between two notes in one lane (Infinity when no lane repeats). */
  sameLaneCloseSec: number;
  events: number;
}

/** Event weight for the density windows and the rating: tap 1, chord 1.5 (+0.5 for the second voice), roll 1, circle 1, spinner 0. */
export function eventWeights(notes: readonly NoteTuple[]): { t: number; w: number }[] {
  const byTime = new Map<number, { t: number; w: number }>();
  for (const n of notes) {
    if (n[3] === 'spin') continue;
    const cur = byTime.get(n[0]) ?? { t: n[0], w: 0 };
    cur.w += cur.w > 0 ? 0.5 : 1;
    byTime.set(n[0], cur);
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

/** Heaviest `win`-second window over time-sorted weighted events, in weight per second. */
export function windowPeak(ev: readonly { t: number; w: number }[], win: number): number {
  let best = 0;
  let j = 0;
  let sum = 0;
  for (let i = 0; i < ev.length; i++) {
    sum += ev[i].w;
    while (ev[i].t - ev[j].t >= win) sum -= ev[j++].w;
    best = Math.max(best, sum);
  }
  return best / win;
}

/** Gaps below `minGapSec` that are not an isolated pair: the gap before or after is also short (a stream, not "ta-KA"). */
export function closeRuns(gaps: readonly number[], minGapSec: number): number {
  let runs = 0;
  for (let i = 0; i < gaps.length; i++) {
    if (gaps[i] >= minGapSec - 1e-9) continue;
    const before = i > 0 && gaps[i - 1] < minGapSec - 1e-9;
    const after = i + 1 < gaps.length && gaps[i + 1] < minGapSec - 1e-9;
    if (before || after) runs++;
  }
  return runs;
}

/** Index of the bar (`barTimes[b] ≤ t < barTimes[b + 1]`) a time falls in; -1 outside the grid. */
function barAt(barTimes: readonly number[], t: number): number {
  if (t < barTimes[0] || t >= barTimes[barTimes.length - 1]) return -1;
  let lo = 0;
  let hi = barTimes.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (barTimes[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const EMPTY_FEATURES: BudgetFeatures = {
  meanNps: 0,
  peak1s: 0,
  peak4s: 0,
  peak8s: 0,
  minGapSec: Infinity,
  gaps: [],
  eighthShare: 0,
  sixteenthShare: 0,
  maxPerBar: 0,
  maxLanes: 4,
  chordsPerBarMax: 0,
  chordsPerPhraseMax: 0,
  circlesPerBarMax: 0,
  circleWindows: 0,
  rollsPerPhraseMax: 0,
  slidesPerPhraseMax: 0,
  spinners: 0,
  sameLaneCloseSec: Infinity,
  events: 0,
};

/**
 * Measures a chart. `barTimes` (bar starts plus the end of the last bar, song s) enable the
 * per-bar and per-phrase counts; without them a bar is assumed to be four beats of `bpm` for the
 * circle-window grouping only.
 */
export function budgetFeatures(
  notes: readonly NoteTuple[],
  bpm: number,
  sections: readonly SectionTuple[] = [[0, 4]],
  barTimes?: readonly number[],
): BudgetFeatures {
  const ev = eventWeights(notes);
  const lane = notes.filter((n) => n[3] !== 'spin');
  const maxLanes = Math.max(...sections.map((s) => s[1]));
  if (ev.length < 2) return { ...EMPTY_FEATURES, maxLanes, events: ev.length };
  const span = Math.max(1, ev[ev.length - 1].t - ev[0].t);
  const total = ev.reduce((a, e) => a + e.w, 0);
  const beat = 60 / Math.max(60, bpm);
  const gaps: number[] = [];
  let eighths = 0;
  let sixteenths = 0;
  for (let i = 1; i < ev.length; i++) {
    const g = ev[i].t - ev[i - 1].t;
    gaps.push(g);
    if (g <= (beat / 2) * 1.25) eighths++;
    if (g <= (beat / 4) * 1.25) sixteenths++;
  }

  // Per bar and per phrase (four bars from bar 0): events, chords (two voices at one time), circles, rolls, slides.
  const voices = new Map<number, number>();
  for (const n of lane) voices.set(n[0], (voices.get(n[0]) ?? 0) + 1);
  let maxPerBar = 0;
  let chordsPerBarMax = 0;
  let chordsPerPhraseMax = 0;
  let circlesPerBarMax = 0;
  let rollsPerPhraseMax = 0;
  let slidesPerPhraseMax = 0;
  if (barTimes && barTimes.length > 1) {
    const perBar = new Map<number, number>();
    const chordsPerBar = new Map<number, number>();
    const chordsPerPhrase = new Map<number, number>();
    const circlesPerBar = new Map<number, number>();
    const rollsPerPhrase = new Map<number, number>();
    const slidesPerPhrase = new Map<number, number>();
    for (const [t, v] of voices) {
      const b = barAt(barTimes, t);
      if (b < 0) continue;
      perBar.set(b, (perBar.get(b) ?? 0) + 1);
      if (v >= 2) {
        chordsPerBar.set(b, (chordsPerBar.get(b) ?? 0) + 1);
        chordsPerPhrase.set(b >> 2, (chordsPerPhrase.get(b >> 2) ?? 0) + 1);
      }
    }
    for (const n of lane) {
      const b = barAt(barTimes, n[0]);
      if (b < 0) continue;
      if (n[3] === 'circle') circlesPerBar.set(b, (circlesPerBar.get(b) ?? 0) + 1);
      else if (n[3] === 'roll') rollsPerPhrase.set(b >> 2, (rollsPerPhrase.get(b >> 2) ?? 0) + 1);
      else if (n[3] === 'slide') slidesPerPhrase.set(b >> 2, (slidesPerPhrase.get(b >> 2) ?? 0) + 1);
    }
    maxPerBar = Math.max(0, ...perBar.values());
    chordsPerBarMax = Math.max(0, ...chordsPerBar.values());
    chordsPerPhraseMax = Math.max(0, ...chordsPerPhrase.values());
    circlesPerBarMax = Math.max(0, ...circlesPerBar.values());
    rollsPerPhraseMax = Math.max(0, ...rollsPerPhrase.values());
    slidesPerPhraseMax = Math.max(0, ...slidesPerPhrase.values());
  }

  // Circle windows: circles closer than a bar to the previous circle belong to the same window.
  const barSec = barTimes && barTimes.length > 1 ? (barTimes[barTimes.length - 1] - barTimes[0]) / (barTimes.length - 1) : beat * 4;
  const circleTimes = [...new Set(lane.filter((n) => n[3] === 'circle').map((n) => n[0]))].sort((a, b) => a - b);
  let circleWindows = 0;
  for (let i = 0; i < circleTimes.length; i++) if (i === 0 || circleTimes[i] - circleTimes[i - 1] > barSec) circleWindows++;

  // Same lane: the closest two lane notes (circles float above the lanes and do not count).
  let sameLaneCloseSec = Infinity;
  const byLane = new Map<number, number[]>();
  for (const n of lane) {
    if (n[3] === 'circle') continue;
    const list = byLane.get(n[1]) ?? [];
    list.push(n[0]);
    byLane.set(n[1], list);
  }
  for (const list of byLane.values()) {
    list.sort((a, b) => a - b);
    for (let i = 1; i < list.length; i++) if (list[i] - list[i - 1] > 0) sameLaneCloseSec = Math.min(sameLaneCloseSec, list[i] - list[i - 1]);
  }

  return {
    meanNps: total / span,
    peak1s: windowPeak(ev, 1),
    peak4s: windowPeak(ev, 4),
    peak8s: windowPeak(ev, 8),
    minGapSec: Math.min(...gaps),
    gaps,
    eighthShare: eighths / gaps.length,
    sixteenthShare: sixteenths / gaps.length,
    maxPerBar,
    maxLanes,
    chordsPerBarMax,
    chordsPerPhraseMax,
    circlesPerBarMax,
    circleWindows,
    rollsPerPhraseMax,
    slidesPerPhraseMax,
    spinners: notes.filter((n) => n[3] === 'spin').length,
    sameLaneCloseSec,
    events: ev.length,
  };
}

/**
 * Every way a chart's features exceed the ★`s` budget (empty = fits): the density windows, the
 * gaps, the fullest bar, the field, and the mechanics a lower ★ does not admit (chords, circles,
 * rolls, slides, spinners — a chart with rolls is never a ★3). Mean nps and the same-lane gap are
 * not judged here: the first is a soft target, the second a hands rule (`assertPlayable`).
 */
export function failsAt(f: BudgetFeatures, s: number): string[] {
  const b = budgetOf(s);
  const fails: string[] = [];
  const minGap = b.pairMinSec || b.minGapSec;
  if (f.peak8s > b.peak8s + 1e-9) fails.push(`peak8s ${f.peak8s.toFixed(2)}>${b.peak8s}`);
  if (f.peak4s > b.peak4s + 1e-9) fails.push(`peak4s ${f.peak4s.toFixed(2)}>${b.peak4s}`);
  if (f.peak1s > b.peak1s + 1e-9) fails.push(`peak1s ${f.peak1s.toFixed(2)}>${b.peak1s}`);
  if (f.minGapSec < minGap - 1e-9) fails.push(`minGap ${f.minGapSec.toFixed(3)}<${minGap}`);
  else {
    const runs = closeRuns(f.gaps, b.minGapSec);
    if (runs > 0) fails.push(`close runs ${runs} (gaps <${b.minGapSec} not isolated)`);
  }
  if (f.maxPerBar > b.maxPerBar[2]) fails.push(`perBar ${f.maxPerBar}>${b.maxPerBar[2]}`);
  if (f.maxLanes > Math.max(...b.lanes[2])) fails.push(`lanes ${f.maxLanes}>${Math.max(...b.lanes[2])}`);
  if (f.chordsPerBarMax > b.chordsPerBar) fails.push(`chords/bar ${f.chordsPerBarMax}>${b.chordsPerBar}`);
  if (f.chordsPerPhraseMax > b.chordsPerPhrase) fails.push(`chords/phrase ${f.chordsPerPhraseMax}>${b.chordsPerPhrase}`);
  if (f.circlesPerBarMax > b.circlesPerBar) fails.push(`circles/bar ${f.circlesPerBarMax}>${b.circlesPerBar}`);
  if (f.circleWindows > b.circleWindows) fails.push(`circle windows ${f.circleWindows}>${b.circleWindows}`);
  if (f.rollsPerPhraseMax > b.rollsPerPhrase) fails.push(`rolls/phrase ${f.rollsPerPhraseMax}>${b.rollsPerPhrase}`);
  if (f.slidesPerPhraseMax > b.slidesPerPhrase) fails.push(`slides/phrase ${f.slidesPerPhraseMax}>${b.slidesPerPhrase}`);
  if (f.spinners > b.spinners) fails.push(`spinners ${f.spinners}>${b.spinners}`);
  return fails;
}

/** Which ★ a chart is: the smallest budget every feature fits; `MAX_STARS + 1` when it fits none (the composer never produces that). */
export function rateStarsBudget(
  notes: readonly NoteTuple[],
  bpm: number,
  sections?: readonly SectionTuple[],
  barTimes?: readonly number[],
): { stars: number; features: BudgetFeatures; why: string } {
  const f = budgetFeatures(notes, bpm, sections, barTimes);
  if (f.events < 2) return { stars: 1, features: f, why: 'empty' };
  let fails: string[] = [];
  for (let s = 1; s <= MAX_STARS; s++) {
    fails = failsAt(f, s);
    if (!fails.length) return { stars: s, features: f, why: 'fits' };
  }
  return { stars: MAX_STARS + 1, features: f, why: fails.join(', ') };
}
