import { DENSITY_LIMIT, DIFFICULTIES, type Difficulty } from '@/shared/config/constants';
import { percentile } from '@/shared/lib/math';
import type { ChartLevel, NoteTuple } from '@/shared/types/chart';
import type { Onset } from './OnsetDetector';

export interface GenerateOptions {
  bpm: number;
  /** Seconds to the first beat. */
  offset: number;
  difficulty: Difficulty;
  laneCount?: number;
  /** Deterministic lane choice for reproducible charts. */
  seed?: number;
}

interface Candidate {
  time: number;
  strength: number;
  bands: [number, number, number];
}

interface DifficultyProfile {
  /** Grid subdivision per beat (4 = sixteenth notes). */
  grid: number;
  /** Keep onsets whose strength is above this percentile of all onsets. */
  strengthPercentile: number;
  /** Minimum gap between notes, in beats. */
  minGapBeats: number;
  /** Strength percentile above which a note becomes a 2-note chord (1 = never). */
  chordPercentile: number;
  /** Strength percentile above which a note may become a hold (1 = never). */
  holdPercentile: number;
  /** Max simultaneous lanes. */
  maxChord: number;
}

const PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: { grid: 2, strengthPercentile: 0.55, minGapBeats: 0.5, chordPercentile: 1, holdPercentile: 1, maxChord: 1 },
  normal: { grid: 4, strengthPercentile: 0.25, minGapBeats: 0.25, chordPercentile: 0.93, holdPercentile: 0.8, maxChord: 2 },
  hard: { grid: 4, strengthPercentile: 0, minGapBeats: 0.125, chordPercentile: 0.8, holdPercentile: 0.7, maxChord: 2 },
};

/** Lane groups by dominant band: bass → left, mids → centre, highs → right (GDD §4 step 7). */
const BAND_LANES: ReadonlyArray<readonly number[]> = [
  [0, 1],
  [1, 2],
  [2, 3],
];

/** Tiny deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Step 6: snap onsets to a beat grid and merge duplicates in the same slot. */
export function quantize(onsets: readonly Onset[], bpm: number, offset: number, grid: number): Candidate[] {
  const step = 60 / bpm / grid;
  const bySlot = new Map<number, Candidate>();
  for (const o of onsets) {
    const slot = Math.round((o.time - offset) / step);
    const time = offset + slot * step;
    if (time < 0) continue;
    const existing = bySlot.get(slot);
    if (!existing) bySlot.set(slot, { time, strength: o.strength, bands: [...o.bands] });
    else if (o.strength > existing.strength) {
      existing.strength = o.strength;
      existing.bands = [...o.bands];
    }
  }
  return [...bySlot.values()].sort((a, b) => a.time - b.time);
}

/** Step 8: keep at most `limit` notes in any 1-second window (drops the later/weaker ones). */
export function capDensity(candidates: Candidate[], limit: number): Candidate[] {
  const out: Candidate[] = [];
  const recent: number[] = [];
  for (const c of candidates) {
    while (recent.length && c.time - recent[0] >= 1) recent.shift();
    if (recent.length >= limit) continue;
    recent.push(c.time);
    out.push(c);
  }
  return out;
}

export function generateChart(onsets: readonly Onset[], opts: GenerateOptions): ChartLevel {
  const profile = PROFILES[opts.difficulty];
  const laneCount = opts.laneCount ?? 4;
  const random = rng(opts.seed ?? 1337);
  const beat = 60 / opts.bpm;

  let candidates = quantize(onsets, opts.bpm, opts.offset, profile.grid);

  // Strength filter.
  const strengths = candidates.map((c) => c.strength);
  const minStrength = percentile(strengths, profile.strengthPercentile);
  candidates = candidates.filter((c) => c.strength >= minStrength);

  // Minimum gap.
  const minGap = profile.minGapBeats * beat - 1e-6;
  const spaced: Candidate[] = [];
  for (const c of candidates) {
    const last = spaced[spaced.length - 1];
    if (last && c.time - last.time < minGap) {
      if (c.strength > last.strength) spaced[spaced.length - 1] = c;
      continue;
    }
    spaced.push(c);
  }
  candidates = capDensity(spaced, DENSITY_LIMIT[opts.difficulty]);

  const chordMin = percentile(strengths, profile.chordPercentile);
  const holdMin = percentile(strengths, profile.holdPercentile);

  const notes: NoteTuple[] = [];
  const laneHistory: number[] = []; // last lanes used, for the "≤2 in a row" rule
  let lastHoldEnd = -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const next = candidates[i + 1];
    const gapToNext = next ? next.time - c.time : Infinity;
    const band = c.bands.indexOf(Math.max(...c.bands));
    const group = BAND_LANES[band] ?? BAND_LANES[1];

    const lanes = pickLanes(group, laneCount, laneHistory, random);
    const chord = profile.maxChord > 1 && c.strength >= chordMin && chordMin < 1 && gapToNext >= beat * 0.25;
    const chosen = chord ? [lanes[0], pickOther(lanes[0], laneCount, laneHistory, random)] : [lanes[0]];

    const canHold =
      !chord &&
      profile.holdPercentile < 1 &&
      c.strength >= holdMin &&
      gapToNext >= beat * 1.5 &&
      c.time - lastHoldEnd >= beat;
    const holdDuration = canHold ? Math.min(gapToNext - beat * 0.5, beat * 2) : 0;

    for (const lane of chosen) {
      if (holdDuration > 0) {
        notes.push([round3(c.time), lane, round3(holdDuration)]);
        lastHoldEnd = c.time + holdDuration;
      } else notes.push([round3(c.time), lane]);
      laneHistory.push(lane);
      if (laneHistory.length > 2) laneHistory.shift();
    }
  }

  return { stars: rateStars(notes), notes };
}

function pickLanes(group: readonly number[], laneCount: number, history: number[], random: () => number): number[] {
  const blocked = history.length >= 2 && history[0] === history[1] ? history[0] : -1;
  const last = history[history.length - 1] ?? -1;
  let pool = group.filter((l) => l !== blocked && l < laneCount);
  if (pool.length === 0) pool = Array.from({ length: laneCount }, (_, i) => i).filter((l) => l !== blocked);
  // Prefer alternating hands: avoid repeating the very last lane when an alternative exists.
  const alt = pool.filter((l) => l !== last);
  const from = alt.length ? alt : pool;
  const first = from[Math.floor(random() * from.length)];
  return [first, ...pool.filter((l) => l !== first)];
}

function pickOther(lane: number, laneCount: number, history: number[], random: () => number): number {
  const blocked = history.length >= 2 && history[0] === history[1] ? history[0] : -1;
  const pool = Array.from({ length: laneCount }, (_, i) => i).filter((l) => l !== lane && l !== blocked);
  return pool[Math.floor(random() * pool.length)];
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Difficulty rating 1–10 from average and peak note density. */
export function rateStars(notes: readonly NoteTuple[]): number {
  if (notes.length < 2) return 1;
  const times = notes.map((n) => n[0]);
  const span = Math.max(1, times[times.length - 1] - times[0]);
  const avgNps = notes.length / span;
  let peak = 0;
  let j = 0;
  for (let i = 0; i < times.length; i++) {
    while (times[i] - times[j] > 2) j++;
    peak = Math.max(peak, (i - j + 1) / 2);
  }
  const holds = notes.filter((n) => n.length === 3).length / notes.length;
  // Calibrated on the built-in catalog so ratings spread over 1–10:
  // Easy ≈ 1 nps → ★2, Normal ≈ 5 nps → ★7, Hard ≈ 8 nps with 12-note bursts → ★10.
  const raw = 0.6 + avgNps * 0.85 + peak * 0.22 + holds * 1.0;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

export function generateAllDifficulties(
  onsets: readonly Onset[],
  bpm: number,
  offset: number,
  seed = 1337,
): Record<Difficulty, ChartLevel> {
  const out = {} as Record<Difficulty, ChartLevel>;
  for (const difficulty of DIFFICULTIES) out[difficulty] = generateChart(onsets, { bpm, offset, difficulty, seed });
  // Stars must be monotonic across difficulties.
  out.normal.stars = Math.max(out.normal.stars, out.easy.stars + 1);
  out.hard.stars = Math.max(out.hard.stars, out.normal.stars + 1);
  out.hard.stars = Math.min(10, out.hard.stars);
  out.normal.stars = Math.min(9, out.normal.stars);
  out.easy.stars = Math.min(8, out.easy.stars);
  return out;
}
