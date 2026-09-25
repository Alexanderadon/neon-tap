import { describe, expect, it } from 'vitest';
import {
  CUSTOM_DAILY_CAP,
  DAILY_ALLOWANCE,
  EMPTY_EARNINGS,
  PASS_CUSTOM_DAILY_CAP,
  PASS_DAILY_ALLOWANCE,
  customDailyCap,
  dailyAllowance,
  earnRun,
  type EarningsState,
  type RunEarningInput,
} from './earnings';

const DAY = '2026-10-05';
const at = (run: number, custom = 0, date = DAY): EarningsState => ({ date, run, custom });
const run = (raw: number, over: Partial<RunEarningInput> = {}): RunEarningInput => ({ raw, date: DAY, pass: false, ...over });

/** Several runs in a row; returns the credits and the final state. */
function day(raws: number[], over: Partial<RunEarningInput> = {}, from: EarningsState = EMPTY_EARNINGS) {
  let state = from;
  const credits: number[] = [];
  for (const raw of raws) {
    const r = earnRun(state, run(raw, over));
    state = r.state;
    credits.push(r.credited);
  }
  return { credits, state };
}

describe('daily allowance', () => {
  it('is 100 crystals a day, 150 with NEON PASS', () => {
    expect(DAILY_ALLOWANCE).toBe(100);
    expect(PASS_DAILY_ALLOWANCE).toBe(150);
    expect(dailyAllowance(false)).toBe(100);
    expect(dailyAllowance(true)).toBe(150);
  });

  it('pays runs in full up to the allowance', () => {
    const r = earnRun(EMPTY_EARNINGS, run(12));
    expect(r).toEqual({ state: at(12), credited: 12, capped: null });
    expect(earnRun(at(88), run(12))).toEqual({ state: at(100), credited: 12, capped: 'day' });
  });

  it('past the allowance pays every fifth crystal: min(raw, left) + floor((raw − left) · 0.2)', () => {
    // 90 counted, 20 more: 10 in full + 10 · 0.2
    expect(earnRun(at(90), run(20))).toMatchObject({ credited: 12, capped: 'day', state: at(110) });
    expect(earnRun(at(100), run(25)).credited).toBe(5);
    expect(earnRun(at(100), run(4)).credited).toBe(0);
    // the fifths add up over the day: five runs of 4 past the allowance pay 4 in all (every fifth crystal), not 0
    expect(day([4, 4, 4, 4, 4], {}, at(100)).credits).toEqual([0, 1, 1, 1, 1]);
  });

  it('NEON PASS: crystals × 1.5 up to its allowance of 150, the same fifths past it', () => {
    expect(earnRun(EMPTY_EARNINGS, run(20, { pass: true }))).toMatchObject({ credited: 30, state: at(30), capped: null });
    // 140 counted, 20 · 1.5 = 30 more: 10 in full + 20 · 0.2
    expect(earnRun(at(140), run(20, { pass: true }))).toMatchObject({ credited: 14, state: at(170), capped: 'day' });
    // odd amounts round half up (5 · 1.5 = 7.5 → 8)
    expect(earnRun(EMPTY_EARNINGS, run(5, { pass: true })).credited).toBe(8);
    // a whole day of runs: 240 counted = the allowance in full + a fifth of the 90 past it
    const { credits } = day([40, 40, 40, 40], { pass: true });
    expect(credits).toEqual([60, 60, 36, 12]);
    expect(credits.reduce((a, b) => a + b, 0)).toBe(PASS_DAILY_ALLOWANCE + 18);
  });

  it('starts over on another local date', () => {
    const yesterday = at(130, 30, '2026-10-04');
    expect(earnRun(yesterday, run(20))).toEqual({ state: at(20), credited: 20, capped: null });
  });

  it('nothing collected: nothing credited, the state is untouched', () => {
    const s = at(50);
    expect(earnRun(s, run(0))).toEqual({ state: s, credited: 0, capped: null });
    expect(earnRun(s, run(-3)).state).toBe(s);
    expect(earnRun(s, run(Number.NaN)).credited).toBe(0);
  });
});

describe('own songs', () => {
  it('pay nothing under a minute', () => {
    const s = at(10);
    expect(earnRun(s, run(8, { custom: { seconds: 59.9 } }))).toEqual({ state: s, credited: 0, capped: 'short' });
    expect(earnRun(s, run(8, { custom: { seconds: 60 } })).credited).toBe(8);
    expect(earnRun(s, run(8, { custom: { seconds: Number.NaN } })).capped).toBe('short');
  });

  it('pay at most 30 crystals a day (45 with NEON PASS)', () => {
    expect(CUSTOM_DAILY_CAP).toBe(30);
    expect(PASS_CUSTOM_DAILY_CAP).toBe(45);
    expect(customDailyCap(false)).toBe(30);
    expect(customDailyCap(true)).toBe(45);
    const song = { custom: { seconds: 180 } };
    const free = day([12, 12, 12, 12], song);
    expect(free.credits).toEqual([12, 12, 6, 0]);
    expect(free.state).toEqual(at(30, 30));
    expect(earnRun(at(10, 24), run(12, song))).toMatchObject({ credited: 6, capped: 'custom' });
    const pass = day([12, 12, 12], { ...song, pass: true });
    expect(pass.credits).toEqual([18, 18, 9]);
    expect(pass.state).toEqual(at(45, 45));
  });

  it('count inside the day allowance, together with catalog runs', () => {
    const song = { custom: { seconds: 120 } };
    // 90 from catalog runs, a song brings 20: 10 in full + 10 · 0.2
    expect(earnRun(at(90), run(20, song))).toEqual({ state: at(110, 20), credited: 12, capped: 'day' });
    // and a song's crystals fill the allowance catalog runs then share
    const after = earnRun(EMPTY_EARNINGS, run(25, song)).state;
    expect(earnRun(after, run(80)).credited).toBe(75 + 1);
  });
});
