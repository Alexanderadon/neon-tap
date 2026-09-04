import { DENSITY_LIMIT, DIFFICULTIES, LANE_COUNT, type Difficulty } from '@/shared/config/constants';
import { percentile } from '@/shared/lib/math';
import type { ChartLevel, NoteKind, NoteTuple, SectionTuple, SpellKind } from '@/shared/types/chart';
import { STEPS_PER_BAR, type Slot, type SongAnalysis } from './SongAnalyzer';

/**
 * Chart composer: turns the analysed beat grid into playable, *musical* patterns.
 *
 * Per bar we pick a rhythm template (quarters, eighths, syncopation, gallop, fill, stream)
 * that best matches where the music actually hits, bounded by difficulty and by the bar's
 * intensity. Sustained melodic sounds become hold notes, strong downbeats become chords,
 * sixteenth runs move across lanes as stairs / trills / zigzags. Every 8-bar phrase may
 * change the number of lanes (2–6) with the music's energy; intense phrases open with
 * osu!-style hit circles. Everything sits on the grid, and everything is playable with two thumbs.
 */

export type Category = 'rest' | 'base' | 'sync' | 'eighth' | 'fill' | 'gallop' | 'stream';

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
  T('gallop', '1011101110111011', 'gallop'),
  T('gallop-r', '1101110111011101', 'gallop'),
  T('run-half', '1010101011111111', 'stream'),
  T('burst3', '1110111011101110', 'stream'),
  T('stream', '1111111111111111', 'stream'),
];

const ALLOWED: Record<Difficulty, readonly Category[]> = {
  easy: ['rest', 'base', 'sync'],
  normal: ['rest', 'base', 'sync', 'eighth', 'fill'],
  hard: ['rest', 'base', 'sync', 'eighth', 'fill', 'gallop', 'stream'],
};

/** Max notes per bar by [quiet, medium, intense]. */
const MAX_NOTES: Record<Difficulty, readonly [number, number, number]> = {
  easy: [2, 3, 4],
  normal: [2, 4, 6],
  hard: [4, 8, 12],
};

/** Slots of silence before a lane-count change so the player can move their hands (2 beats). */
const SECTION_GAP_SLOTS = 8;

/** Fewer lanes → fewer notes per bar, or 2-lane streams turn into trill hell. */
const MAX_NOTES_BY_LANES: Record<number, number> = { 2: 8, 3: 12 };

/** Template notes on (near-)silent slots are dropped — a note with nothing to hear feels random. */
const MIN_NOTE_STRENGTH = 0.1;

/**
 * Salience = what a listener would tap along to: kicks, snares and melody count fully,
 * hi-hat-only ticks (energy almost all above 2 kHz) count much less.
 */
export function salience(s: Slot): number {
  return s.strength * (0.5 + 0.5 * (1 - s.high));
}

const HOLD_CHANCE = [0.9, 0.7, 0.45] as const; // by intensity
const HOLD_BUDGET: Record<Difficulty, number> = { easy: 3, normal: 3, hard: 3 };
const MAX_HOLD_SLOTS: Record<Difficulty, number> = { easy: 16, normal: 16, hard: 16 };
/**
 * Two-finger rule (phones are played with two thumbs): at most ONE hold at a time, chords only
 * while nothing is held, never more than two simultaneous notes.
 */
const MAX_ACTIVE_HOLDS = 1;
const MAX_CHORD = 2;

/** A spell note every this many bars, starting at bar 4 (after the intro). */
const SPELL_EVERY_BARS = 8;
const SPELL_ORDER: readonly SpellKind[] = ['slow', 'heart'];

/** Circles per phrase-start bar by difficulty. */
const CIRCLES_PER_BAR: Record<Difficulty, number> = { easy: 2, normal: 3, hard: 4 };

/** Lane-count sections: one decision per 8-bar phrase, pools by [quiet, medium, intense]. */
const PHRASE_BARS = 8;
const LANE_POOLS: Record<Difficulty, readonly [readonly number[], readonly number[], readonly number[]]> = {
  easy: [[4], [4], [4]],
  normal: [[3], [4], [5]],
  hard: [
    [2, 3],
    [3, 4],
    [5, 6],
  ],
};

export interface ComposeOptions {
  difficulty: Difficulty;
  seed?: number;
  /** Let the lane count follow the music (2–6 lanes). Default: on for normal/hard. */
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
  const sm = e.map((_, i) => 0.25 * (e[i - 1] ?? e[i]) + 0.5 * e[i] + 0.25 * (e[i + 1] ?? e[i]));
  const q35 = percentile(sm, 0.35);
  const q70 = percentile(sm, 0.7);
  for (let i = 0; i < bars.length; i++) {
    const v = sm[i];
    bars[i].intensity = v >= Math.max(q70, 0.3) ? 2 : v >= Math.max(q35, 0.1) ? 1 : 0;
  }
}

/**
 * Lane count per 8-bar phrase: calm parts shrink to 2–3 lanes, choruses open up to 5–6.
 * The intro always starts on 4 lanes; a phrase with the same energy as the previous one
 * usually keeps its lane count so a chorus reads as one block.
 */
export function planSections(bars: Bar[], difficulty: Difficulty, variation: boolean, random: () => number): SectionTuple[] {
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
      const pool = LANE_POOLS[difficulty][intensity];
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

export function composeChart(analysis: SongAnalysis, opts: ComposeOptions): ChartLevel {
  const { difficulty } = opts;
  const random = rng(opts.seed ?? 1337);
  const slots = analysis.slots;
  if (slots.length < STEPS_PER_BAR) return { stars: 1, notes: [], sections: [[0, LANE_COUNT]] };

  const bars = groupBars(slots);
  rateIntensity(bars);
  const sections = planSections(bars, difficulty, opts.laneVariation ?? difficulty !== 'easy', random);
  const barSeconds = (60 / analysis.bpm) * 4;
  const allowed = TEMPLATES.filter((t) => ALLOWED[difficulty].includes(t.category) && t.count / barSeconds <= DENSITY_LIMIT[difficulty]);

  // 1. Rhythm per bar — a template, minus notes on slots where nothing is audible.
  const events: Event[] = [];
  for (const bar of bars) {
    const maxNotes = Math.min(MAX_NOTES[difficulty][bar.intensity], MAX_NOTES_BY_LANES[bar.lanes] ?? 16);
    const strength = bar.slots.map(salience);
    const phraseEnd = bar.index % 4 === 3;
    const scored = allowed
      .filter((t) => t.count <= maxNotes)
      .map((t) => ({ t, s: scoreTemplate(t, strength, bar.intensity, phraseEnd) }))
      .sort((a, b) => b.s - a.s);
    if (!scored.length) continue;
    const pool = scored.filter((x) => x.s >= scored[0].s - 0.12);
    const pick = pool[Math.floor(random() * pool.length)].t;
    for (let step = 0; step < bar.slots.length; step++) {
      if (pick.mask[step] === '1' && salience(bar.slots[step]) >= MIN_NOTE_STRENGTH) {
        events.push({ si: bar.start + step, bar, step, size: 1, hold: 0, kind: null });
      }
    }
  }

  // 1a. Breathing room before every lane-count change, and a hard per-second cap (sliding window).
  const lastBarOfSection = new Set<number>();
  for (let i = 0; i + 1 < bars.length; i++) if (bars[i + 1].lanes !== bars[i].lanes) lastBarOfSection.add(bars[i].index);
  let filtered = events.filter((ev) => !(lastBarOfSection.has(ev.bar.index) && ev.step >= STEPS_PER_BAR - SECTION_GAP_SLOTS));
  filtered = capDensity(filtered, slots, DENSITY_LIMIT[difficulty]);
  events.length = 0;
  events.push(...filtered);

  // 1b. Spell notes: the first note of every 8th bar (from bar 4) alternates slow / heart.
  let spellCount = 0;
  for (let b = 4; b < bars.length; b += SPELL_EVERY_BARS) {
    const ev = events.find((e) => e.bar.index === b) ?? events.find((e) => e.bar.index === b + 1);
    if (!ev) continue;
    ev.kind = SPELL_ORDER[spellCount++ % SPELL_ORDER.length];
  }

  // 1c. Circles: at the start of an intense phrase (chorus / drop) the on-beat notes of the first
  // bar become osu!-style hit circles — a sudden change of interaction right where the music peaks.
  for (const bar of bars) {
    const phraseStart = bar.index % PHRASE_BARS === 0 || (difficulty === 'hard' && bar.index % PHRASE_BARS === PHRASE_BARS / 2);
    if (!phraseStart || bar.intensity !== 2 || bar.index < 4) continue;
    let placed = 0;
    let lastSi = -100;
    for (const ev of events) {
      if (ev.bar !== bar) continue;
      if (ev.step % 4 !== 0 || ev.kind || ev.si - lastSi < 4) continue;
      ev.kind = 'circle';
      placed++;
      lastSi = ev.si;
      if (placed >= CIRCLES_PER_BAR[difficulty]) break;
    }
  }

  // 2. Holds on sustained melodic sounds, chords on strong downbeats — under the two-finger rule.
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
    if (ev.kind) continue; // spells and circles stay plain taps
    const budget = holdBudget.get(ev.bar.index) ?? HOLD_BUDGET[difficulty];
    const melodic = slot.low < 0.55;
    if (slot.sustain >= 2 && melodic && budget > 0 && activeHoldEnds.length < MAX_ACTIVE_HOLDS && random() < HOLD_CHANCE[intensity]) {
      let dur = Math.min(slot.sustain, MAX_HOLD_SLOTS[difficulty]);
      if (difficulty === 'easy') dur = Math.min(dur, gapNext - 1);
      // A hold must end before the silence that precedes a lane-count change.
      const barEnd = ev.bar.start + ev.bar.slots.length;
      if (lastBarOfSection.has(ev.bar.index)) dur = Math.min(dur, barEnd - SECTION_GAP_SLOTS - ev.si);
      else if (lastBarOfSection.has(ev.bar.index + 1)) dur = Math.min(dur, barEnd + STEPS_PER_BAR - SECTION_GAP_SLOTS - ev.si);
      if (dur >= 2) {
        ev.hold = dur;
        holdBudget.set(ev.bar.index, budget - 1);
        activeHoldEnds.push(ev.si + dur);
        activeHoldEnds.sort((a, b) => a - b);
        continue;
      }
    }

    if (difficulty === 'easy') continue;
    if (activeHoldEnds.length) continue; // two-finger rule: one thumb is busy holding
    const onDown = ev.step === 0 || ev.step === 8;
    const accent = slot.strength >= 0.9;
    const inStream = gapPrev <= 1 || gapNext <= 1;
    const chords = chordBudget.get(ev.bar.index) ?? 0;
    const wantChord = (intensity === 2 && onDown) || (intensity >= 1 && accent && onDown) || (difficulty === 'hard' && accent);
    if (!wantChord || chords >= (difficulty === 'hard' ? 4 : 2)) continue;
    if (difficulty === 'normal' && inStream) continue;
    if (difficulty === 'hard' && inStream && ev.step !== 0) continue;
    ev.size = MAX_CHORD;
    chordBudget.set(ev.bar.index, chords + 1);
  }

  // 3. Lanes.
  const notes = assignLanes(events, slots, difficulty, random);
  return { stars: rateStars(notes), notes, sections };
}

/** Keep at most `limit` distinct note times in any 1-second window, dropping the least salient extras. */
function capDensity(events: Event[], slots: readonly Slot[], limit: number): Event[] {
  const kept: Event[] = [];
  for (const ev of events) {
    kept.push(ev);
    const t = slots[ev.si].time;
    const window = kept.filter((e) => slots[e.si].time > t - 1);
    if (window.length <= limit) continue;
    // Drop the weakest in the window (never the one on a downbeat if avoidable).
    let weakest = window[0];
    for (const e of window) {
      const a = salience(slots[e.si]) + (e.step % 4 === 0 ? 0.3 : 0);
      const b = salience(slots[weakest.si]) + (weakest.step % 4 === 0 ? 0.3 : 0);
      if (a < b) weakest = e;
    }
    kept.splice(kept.indexOf(weakest), 1);
  }
  return kept;
}

type MotionKind = 'up' | 'down' | 'zigzag' | 'trill' | 'jack';

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
      case 'jack': {
        const j = up.flatMap((l) => [l, l]);
        this.seq = random() < 0.5 ? j : j.reverse();
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

function assignLanes(events: readonly Event[], slots: readonly Slot[], difficulty: Difficulty, random: () => number): NoteTuple[] {
  const notes: NoteTuple[] = [];
  const heldUntil = new Array<number>(8).fill(-1);
  /** Consecutive events that used each lane — the "≤ 2 in a row per lane" rule (GDD §4). */
  const laneRun = new Array<number>(8).fill(0);
  let lastLane = -1;
  let lastSi = -100;
  let lastSide = 1;
  let motion: Motion | null = null;
  let motionBar = -1;
  let lastLanes = -1;

  for (const ev of events) {
    const slot = slots[ev.si];
    const n = ev.bar.lanes;
    if (n !== lastLanes) {
      // Section change: old holds cannot carry over, runs restart.
      heldUntil.fill(-1);
      laneRun.fill(0);
      lastLanes = n;
      lastLane = -1;
    }
    const free: number[] = [];
    for (let l = 0; l < n; l++) if (heldUntil[l] < ev.si) free.push(l);
    if (!free.length) continue;
    const gap = ev.si - lastSi;

    if (ev.bar.index !== motionBar) {
      motionBar = ev.bar.index;
      const kinds: MotionKind[] = difficulty === 'hard' && ev.bar.intensity === 2 ? ['up', 'down', 'zigzag', 'trill', 'jack'] : ['up', 'down', 'zigzag', 'trill'];
      motion = new Motion(kinds[Math.floor(random() * kinds.length)], n, random);
    }

    let candidates = free.filter((l) => laneRun[l] < 2);
    if (!candidates.length) candidates = free;

    let lanes: number[];
    if (ev.size >= 2) {
      const pair = chordPairs(n, ev.step === 0).find((p) => p.every((l) => candidates.includes(l)));
      lanes = pair ? [...pair] : [candidates[Math.floor(random() * candidates.length)]]; // no clean pair → single note
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
        // Circles always move to a fresh lane so a group reads as a path.
        const choose = fresh.length && (ev.kind === 'circle' || random() < 0.8) ? fresh : pool;
        lane = choose[Math.floor(random() * choose.length)];
      }
      lanes = [lane];
    }

    const time = round3(slot.time);
    for (const lane of lanes) {
      if (ev.hold > 0) {
        const endIdx = Math.min(slots.length - 1, ev.si + ev.hold);
        const dur = round3(slots[endIdx].time - slot.time);
        notes.push([time, lane, dur]);
        heldUntil[lane] = endIdx;
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

/** Difficulty rating 1–10 from average and peak note density plus hold share. */
export function rateStars(notes: readonly NoteTuple[]): number {
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
  const holds = notes.filter((n) => n.length === 3).length / notes.length;
  const raw = 0.6 + avgNps * 0.85 + peak * 0.22 + holds * 1.0;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

export interface GenerateAllOptions {
  seed?: number;
  /** Per-difficulty override of lane variation (default: off for easy, on otherwise). */
  laneVariation?: Partial<Record<Difficulty, boolean>>;
}

export function generateAllDifficulties(analysis: SongAnalysis, seedOrOpts: number | GenerateAllOptions = 1337): Record<Difficulty, ChartLevel> {
  const opts = typeof seedOrOpts === 'number' ? { seed: seedOrOpts } : seedOrOpts;
  const out = {} as Record<Difficulty, ChartLevel>;
  for (const difficulty of DIFFICULTIES) {
    out[difficulty] = composeChart(analysis, { difficulty, seed: opts.seed ?? 1337, laneVariation: opts.laneVariation?.[difficulty] });
  }
  // Stars must be monotonic across difficulties.
  out.normal.stars = Math.max(out.normal.stars, out.easy.stars + 1);
  out.hard.stars = Math.max(out.hard.stars, out.normal.stars + 1);
  out.hard.stars = Math.min(10, out.hard.stars);
  out.normal.stars = Math.min(9, out.normal.stars);
  out.easy.stars = Math.min(8, out.easy.stars);
  return out;
}
