/**
 * The daily crystal allowance (docs/plans/economy-drops-mymusic.md §1). Crystals collected in runs
 * (gems and hearts caught past ten) count towards a day's allowance: in full up to it, then every
 * fifth. NEON PASS multiplies them by 1.5 up to a larger allowance. The player's own songs pay
 * nothing when shorter than a minute and have a small daily cap of their own inside the allowance.
 * The daily track, first clears, the login calendar and badges pay outside it.
 */

/** Crystals a day's runs pay in full; with NEON PASS. */
export const DAILY_ALLOWANCE = 100;
export const PASS_DAILY_ALLOWANCE = 150;
/** Past the allowance a run pays this share (every fifth crystal). */
export const OVER_ALLOWANCE_RATE = 0.2;
/** NEON PASS: run crystals count this many times (up to the allowance). */
export const PASS_CRYSTAL_MULTIPLIER = 1.5;
/** The player's own songs: shorter ones pay nothing; the most they pay in a day (inside the allowance). */
export const CUSTOM_MIN_SECONDS = 60;
export const CUSTOM_DAILY_CAP = 30;
export const PASS_CUSTOM_DAILY_CAP = 45;
/** Bonuses outside the allowance: today's daily track, the first three stars and the first crown on a track (once each). */
export const DAILY_TRACK_CRYSTALS = 10;
export const FIRST_STARS_CRYSTALS = 10;
export const FIRST_CROWN_CRYSTALS = 10;

/** What today's runs have put towards the allowance. */
export interface EarningsState {
  /** Local date (YYYY-MM-DD) the counters belong to; another date is a fresh day. */
  date: string;
  /** Run crystals counted today (after the PASS multiplier), the part past the allowance included. */
  run: number;
  /** Of those, from the player's own songs (their own daily cap). */
  custom: number;
}

export const EMPTY_EARNINGS: EarningsState = { date: '', run: 0, custom: 0 };

/** Why a run paid fewer crystals than it collected: the day's allowance is full, the own-songs cap is reached, the song is under a minute. */
export type EarningCap = 'day' | 'custom' | 'short';

export interface RunEarningInput {
  /** Crystals collected in the run. */
  raw: number;
  /** Local date of the run. */
  date: string;
  pass: boolean;
  /** The player's own song and its length in seconds. */
  custom?: { seconds: number };
}

export interface RunEarning {
  state: EarningsState;
  /** Crystals to credit to the wallet. */
  credited: number;
  capped: EarningCap | null;
}

export function dailyAllowance(pass: boolean): number {
  return pass ? PASS_DAILY_ALLOWANCE : DAILY_ALLOWANCE;
}

export function customDailyCap(pass: boolean): number {
  return pass ? PASS_CUSTOM_DAILY_CAP : CUSTOM_DAILY_CAP;
}

/** Every fifth crystal of the part past the allowance, counted over the whole day (so short runs past it still add up). */
const overPay = (run: number, allowance: number) => Math.floor(Math.max(0, run - allowance) * OVER_ALLOWANCE_RATE);

/**
 * Credit a run's crystals against the day's allowance: `min(raw·m, left) + floor(max(0, raw·m − left)·0.2)`,
 * m = 1.5 with NEON PASS. The fifths past the allowance are counted over the day's total, so four
 * runs of five crystals past it pay four, not zero. Pure: returns the new state and the credit.
 */
export function earnRun(state: EarningsState, input: RunEarningInput): RunEarning {
  const raw = Math.max(0, Math.floor(Number.isFinite(input.raw) ? input.raw : 0));
  if (raw === 0) return { state, credited: 0, capped: null };
  if (input.custom && !(input.custom.seconds >= CUSTOM_MIN_SECONDS)) return { state, credited: 0, capped: 'short' };
  const today = state.date === input.date ? state : { date: input.date, run: 0, custom: 0 };
  let scaled = Math.round(raw * (input.pass ? PASS_CRYSTAL_MULTIPLIER : 1));
  let capped: EarningCap | null = null;
  let custom = today.custom;
  if (input.custom) {
    const room = Math.max(0, customDailyCap(input.pass) - today.custom);
    if (scaled >= room) {
      scaled = room;
      capped = 'custom';
    }
    custom += scaled;
  }
  const allowance = dailyAllowance(input.pass);
  const before = today.run;
  const after = before + scaled;
  const inside = Math.max(0, Math.min(after, allowance) - Math.min(before, allowance));
  const over = overPay(after, allowance) - overPay(before, allowance);
  if (after >= allowance) capped = 'day';
  return { state: { date: input.date, run: after, custom }, credited: inside + over, capped };
}
