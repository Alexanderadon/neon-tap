/**
 * Weekly drops («Новинка недели», docs/plans/economy-drops-mymusic.md §2): the release clock and the
 * lock of one weekly track. Pure — the caller passes the time (`shared/lib/time` `now()`), so the
 * same rules serve the deck, the shop and `scripts/lib/drops.ts`. NEON PASS is a flag here, not an
 * import: the widgets read the pass and pass it in.
 */

export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;
/** Moscow keeps UTC+3 all year: a drop opens at Monday 00:00 MSK = Sunday 21:00 UTC, for everyone at once. */
const MSK_OFFSET_MS = 3 * 3_600_000;

/** A weekly track costs this many crystals whatever its ★ (the premium formula would make it 213–325). */
export const DROP_PRICE = 150;
/** The deck shows a drop this long before its release: locked «soon», or open early with NEON PASS. */
export const DROP_EARLY_MS = 7 * DAY_MS;
/** A rewarded ad opens a drop during its first 14 days — a week missed does not lose the chance. */
export const DROP_AD_MS = 14 * DAY_MS;

/** The release plan in the app: the first Monday and the number of weekly slots (`assets-src/drops.json`). */
export interface DropSchedule {
  start: string;
  weeks: number;
}

/** `YYYY-MM-DD` → its parts, or null when it is not a real calendar date. */
export function parseDate(date: string | undefined): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

/** The date is a Monday (release days are Mondays). */
export function isMonday(date: string): boolean {
  const p = parseDate(date);
  return p !== null && new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() === 1;
}

/** When a drop dated `date` opens: 00:00 Moscow time of that day, ms since the epoch. A missing or bad date never opens (Infinity). */
export function releaseMs(date: string | undefined): number {
  const p = parseDate(date);
  return p ? Date.UTC(p.y, p.m - 1, p.d) - MSK_OFFSET_MS : Number.POSITIVE_INFINITY;
}

/** The release date of schedule week `week` (1 = the start Monday), `YYYY-MM-DD`. */
export function slotDate(start: string, week: number): string {
  const p = parseDate(start);
  if (!p) return '';
  return new Date(Date.UTC(p.y, p.m - 1, p.d + 7 * (week - 1))).toISOString().slice(0, 10);
}

/**
 * The schedule week running at `nowMs`: 0 before the start Monday, 1 during the first week, and on
 * past the last slot (the caller compares with the slot count). Weeks turn at Monday 00:00 Moscow.
 */
export function weekIndex(nowMs: number, start: string): number {
  const at = releaseMs(start);
  if (!Number.isFinite(at) || nowMs < at) return 0;
  return Math.floor((nowMs - at) / WEEK_MS) + 1;
}

/** The next week still to open at `nowMs` (1-based), or null when the schedule is over. */
export function nextWeek(nowMs: number, schedule: DropSchedule): number | null {
  const next = weekIndex(nowMs, schedule.start) + 1;
  return next <= schedule.weeks ? next : null;
}

/**
 * The next week to open when it has no track (the deck shows «Новые треки — по понедельникам» for
 * it, without a date), else null — a filled next week is the drop's own «soon» card instead.
 */
export function emptyNextWeek(nowMs: number, schedule: DropSchedule, drops: readonly { release?: string }[]): number | null {
  const week = nextWeek(nowMs, schedule);
  if (week === null) return null;
  const date = slotDate(schedule.start, week);
  return drops.some((t) => t.release === date) ? null : week;
}

/** The drop is in the deck: from a week before its release (as «soon», or open with PASS). */
export function isDropVisible(track: { release?: string }, nowMs: number): boolean {
  return nowMs >= releaseMs(track.release) - DROP_EARLY_MS;
}

export interface DropContext {
  nowMs: number;
  /** The id is in `purchased` (bought, an ad, or a PASS grant — all stay after PASS ends). */
  owned: boolean;
  /** NEON PASS is active. */
  pass: boolean;
  /** `UNLOCK_ALL` / `?unlock=1`. */
  unlockAll: boolean;
}

export interface DropState {
  /** Playable: owned, everything unlocked, or PASS from a week before the release. */
  open: boolean;
  /** Not out yet and not open: locked, neither an ad nor crystals can open it. */
  soon: boolean;
  /** A rewarded ad may open it: not open, released, within its first 14 days (the widget also asks `ads.available()`). */
  adEligible: boolean;
  /** Crystals to buy it once released. */
  price: number;
  /** When it opens for everyone, ms (Infinity for a bad date). */
  releaseAt: number;
  /** This week's drop: released less than seven days ago — the «Новинка недели» tag. */
  thisWeek: boolean;
  /** Open before its release thanks to NEON PASS — the «С PASS — раньше всех» tag. */
  early: boolean;
}

/** The lock of one weekly track at `ctx.nowMs` (spec §2.2). */
export function dropState(track: { release?: string }, ctx: DropContext): DropState {
  const releaseAt = releaseMs(track.release);
  const released = ctx.nowMs >= releaseAt;
  const passEarly = ctx.pass && ctx.nowMs >= releaseAt - DROP_EARLY_MS;
  const open = ctx.owned || ctx.unlockAll || passEarly;
  return {
    open,
    soon: !open && !released,
    adEligible: !open && released && ctx.nowMs < releaseAt + DROP_AD_MS,
    price: DROP_PRICE,
    releaseAt,
    thisWeek: released && ctx.nowMs < releaseAt + WEEK_MS,
    early: passEarly && !released,
  };
}

/** Whole days until the release, rounded up (1 = «завтра»); 0 once it is out. */
export function daysUntil(releaseAt: number, nowMs: number): number {
  if (!(releaseAt > nowMs)) return 0;
  return Math.ceil((releaseAt - nowMs) / DAY_MS);
}
