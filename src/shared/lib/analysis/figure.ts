import { STEPS_PER_BAR } from './SongAnalyzer';

/**
 * The figure of a 4-bar phrase: which steps of the bar the player taps. It is picked from the
 * phrase's audibility profile under the ★ budget — at most K steps, on the grid the budget's gap
 * allows (eighths or beats), beats first — and repeated in every bar of the phrase, so the hands
 * learn one pattern per phrase instead of chasing a new layout every bar.
 */
export interface Figure {
  /** Steps in placement priority (loudest first). */
  steps: number[];
  /** Per-step mean audibility over the phrase's bars. */
  profile: number[];
  /** Sorted steps joined with ',' — lane memory follows it, and equal signatures mean "the same figure". */
  signature: string;
  /** How many steps the budget allowed. */
  budget: number;
}

/** A slot is a candidate only when the mix (or a present stem) really hits there. */
export const MIN_AUDIBLE = 0.25;
/** A figure step must reach this share of the phrase's loudest step. */
export const PATTERN_REL = 0.4;
/** A beat this audible (and a local maximum) is always in the figure — the guard against charting a bass line over four-on-the-floor kicks. */
const MUST_BEAT_AUD = 0.8;
/** Figure inertia: the previous phrase's figure is kept while every step still reaches this share of the new max … */
const FIGURE_KEEP_REL = 0.45;
/** … and no step this loud has appeared outside it. */
const FIGURE_NEW_REL = 0.9;
/** A pickup ("ta-KA": an eighth before or after a figure step) must be this loud. */
const PICKUP_REL = 0.6;

/** Grid preference: beats > eighths > off-sixteenths, and the bar's halves a little more — the figure reads as "beats plus a pickup". */
export const gridBonus = (step: number): number => (step % 4 === 0 ? 0.2 : step % 2 === 0 ? 0.05 : -0.15) + (step % 8 === 0 ? 0.05 : 0);

/** Distance between two steps of the bar, circular (the bar repeats). */
export const stepDist = (a: number, b: number): number => Math.min(Math.abs(a - b), STEPS_PER_BAR - Math.abs(a - b));

const signatureOf = (steps: readonly number[]): string => [...steps].sort((a, b) => a - b).join(',');

/**
 * The figure of a phrase profile: candidates are circular local maxima of `profile + gridBonus`
 * reaching `PATTERN_REL` of the max (beats qualify even when not maxima), taken loudest first with
 * `gapSlots` between them, at most `K`; beats ≥ `MUST_BEAT_AUD` always go in first. Then one pickup
 * pair when `pair` allows it at this tempo: a loud eighth-neighbour of exactly one figure step with a
 * beat of air from every other step. With `prev` (the previous phrase, same level), that figure is
 * kept while it still sounds here and nothing new stands out.
 */
export function figureOf(profile: readonly number[], K: number, gapSlots: number, pair: { minSec: number; slotSec: number } | null, prev?: Figure): Figure {
  const prof = [...profile];
  const empty: Figure = { steps: [], profile: prof, signature: '', budget: K };
  const max = Math.max(...prof);
  if (!(max >= MIN_AUDIBLE) || K <= 0) return empty;
  const n = prof.length;
  const weighted = prof.map((v, s) => v + gridBonus(s));
  const cand: { step: number; score: number; must: boolean }[] = [];
  for (let s = 0; s < n; s++) {
    const v = prof[s];
    if (v < PATTERN_REL * max || v < MIN_AUDIBLE) continue;
    const peak = weighted[s] >= weighted[(s + n - 1) % n] && weighted[s] >= weighted[(s + 1) % n];
    if (!peak && s % 4 !== 0) continue;
    cand.push({ step: s, score: weighted[s], must: peak && s % 4 === 0 && v >= MUST_BEAT_AUD });
  }
  cand.sort((a, b) => Number(b.must) - Number(a.must) || b.score - a.score || a.step - b.step);

  if (prev && prev.steps.length && prev.steps.length <= K) {
    const kept = prev.steps.every((st) => prof[st] >= FIGURE_KEEP_REL * max);
    const fresh = cand.some((c) => !prev.steps.includes(c.step) && (c.must || prof[c.step] >= FIGURE_NEW_REL * max));
    if (kept && !fresh) {
      const steps = [...prev.steps].sort((a, b) => weighted[b] - weighted[a] || a - b);
      return { steps, profile: prof, signature: prev.signature, budget: K };
    }
  }

  const chosen: number[] = [];
  for (const c of cand) {
    if (chosen.length >= K) break;
    if (chosen.some((st) => stepDist(st, c.step) < gapSlots)) continue;
    chosen.push(c.step);
  }
  if (pair && pair.minSec > 0 && chosen.length < K && 2 * pair.slotSec >= pair.minSec - 1e-9 && gapSlots > 2) {
    const pickup = cand.find((c) => {
      if (chosen.includes(c.step) || prof[c.step] < PICKUP_REL * max) return false;
      const partners = chosen.filter((st) => stepDist(st, c.step) === 2);
      if (partners.length !== 1) return false;
      return chosen.every((st) => st === partners[0] || stepDist(st, c.step) >= 4);
    });
    if (pickup) chosen.push(pickup.step);
  }
  return { steps: chosen, profile: prof, signature: signatureOf(chosen), budget: K };
}

/**
 * The figure minus its weakest step — the least audible / most off-beat one, a must-beat only when
 * nothing else is left. The shrink pass removes a whole step from a phrase so repetition survives
 * thinning; an empty figure stays empty.
 */
export function shrinkFigure(f: Figure): Figure {
  if (!f.steps.length) return { ...f, budget: Math.max(0, f.budget - 1) };
  const must = (s: number): boolean => s % 4 === 0 && f.profile[s] >= MUST_BEAT_AUD;
  const order = [...f.steps].sort((a, b) => Number(must(a)) - Number(must(b)) || f.profile[a] + gridBonus(a) - (f.profile[b] + gridBonus(b)) || b - a);
  const steps = f.steps.filter((s) => s !== order[0]);
  return { steps, profile: f.profile, signature: signatureOf(steps), budget: Math.max(0, f.budget - 1) };
}
