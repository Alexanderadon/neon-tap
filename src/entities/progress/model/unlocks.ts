/** The first N catalog positions (easiest songs) are always playable. */
export const ALWAYS_OPEN = 5;
/** Threshold growth per catalog position past the free ones. */
export const STARS_PER_POSITION = 2.2;
/** The hardest track must open before the very last stars: cap = max stars − this. */
export const THRESHOLD_HEADROOM = 6;
/** Stars a single track can yield (pass / A / S). */
export const STARS_PER_TRACK = 3;

/**
 * Stars needed to open the track at `position` (0-based, easiest first) on a road of
 * `catalogSize` songs: 0 for the first ALWAYS_OPEN, then round((position − 4) · 2.2), never above
 * `catalogSize · 3 − 6` so the last song opens before the player has to perfect everything.
 * The road is the non-premium tracks (see `roadThresholds`).
 */
export function unlockThreshold(position: number, catalogSize: number): number {
  if (position < ALWAYS_OPEN) return 0;
  const cap = Math.max(0, catalogSize * STARS_PER_TRACK - THRESHOLD_HEADROOM);
  return Math.min(cap, Math.round((position - (ALWAYS_OPEN - 1)) * STARS_PER_POSITION));
}

export interface UnlockContext {
  /** Player's stars including bonuses. */
  stars: number;
  /** Today's daily track — always open (a premium daily is a free taste for the day). */
  dailyId?: string | null;
  /** `UNLOCK_ALL` / `?unlock=1`: everything open. */
  unlockAll?: boolean;
  /** Track ids bought in the shop — open regardless of stars. */
  purchased?: readonly string[];
  /** Premium track ids — never open by stars, only by purchase (or as the daily track). */
  premium?: readonly string[];
}

export interface UnlockInfo {
  id: string;
  unlocked: boolean;
  /** Stars required (0 when free; 0 for premium tracks, which never open by stars). */
  need: number;
  /** Premium: shop-only. */
  premium: boolean;
  /** Bought in the shop. */
  purchased: boolean;
}

/**
 * The unlock rule: a track is playable when everything is open, when it was bought, when it is
 * today's daily track, or — for non-premium tracks only — when the player has enough stars.
 */
export function isOpen(need: number, premium: boolean, purchased: boolean, isDaily: boolean, ctx: UnlockContext): boolean {
  if (ctx.unlockAll === true || purchased || isDaily) return true;
  return !premium && ctx.stars >= need;
}

/**
 * Stars needed per catalog track, in catalog order. The road counts only the tracks that open by
 * stars: a track's position is its place among the non-premium ones and the cap follows their
 * number, so premium tracks in the middle of the catalog never push the road further (the rock
 * pack after them opens at 70 / 73 / 75 instead of 81 / 84 / 86). Premium tracks need 0 — they
 * never open by stars.
 */
export function roadThresholds(catalogIds: readonly string[], premium: readonly string[] = []): number[] {
  const shopOnly = new Set(premium);
  const roadSize = catalogIds.filter((id) => !shopOnly.has(id)).length;
  let position = 0;
  return catalogIds.map((id) => (shopOnly.has(id) ? 0 : unlockThreshold(position++, roadSize)));
}

/** Unlock state for every catalog track, in catalog order. */
export function unlockStates(catalogIds: readonly string[], ctx: UnlockContext): UnlockInfo[] {
  const needs = roadThresholds(catalogIds, ctx.premium);
  return catalogIds.map((id, i) => {
    const need = needs[i];
    const premium = ctx.premium?.includes(id) ?? false;
    const purchased = ctx.purchased?.includes(id) ?? false;
    return { id, unlocked: isOpen(need, premium, purchased, id === ctx.dailyId, ctx), need, premium, purchased };
  });
}

/** Is a track playable? Ids outside the catalog (custom songs) are always open. */
export function isTrackUnlocked(catalogIds: readonly string[], id: string, ctx: UnlockContext): boolean {
  const i = catalogIds.indexOf(id);
  if (i < 0) return true;
  const premium = ctx.premium?.includes(id) ?? false;
  const purchased = ctx.purchased?.includes(id) ?? false;
  return isOpen(roadThresholds(catalogIds, ctx.premium)[i], premium, purchased, id === ctx.dailyId, ctx);
}

/**
 * Ids that are open with `after` stars but were locked with `before` (the daily track never
 * "unlocks"; premium tracks never open by stars, so they are skipped too).
 */
export function newlyUnlocked(catalogIds: readonly string[], before: number, after: number, premium: readonly string[] = []): string[] {
  const out: string[] = [];
  if (after <= before) return out;
  const needs = roadThresholds(catalogIds, premium);
  catalogIds.forEach((id, i) => {
    if (premium.includes(id)) return;
    if (before < needs[i] && after >= needs[i]) out.push(id);
  });
  return out;
}

/** The nearest track still closed by stars (the result screen's «до открытия …» bar). */
export interface NextUnlock {
  id: string;
  /** Stars required. */
  need: number;
  /** Stars the player has now. */
  have: number;
  /** Stars still missing (≥ 1). */
  missing: number;
}

/**
 * The next track that opens by stars: the first closed, non-premium entry in catalog order (the
 * catalog is sorted easiest first, so it is also the cheapest). Premium and bought tracks never
 * open by stars and are skipped; `null` when everything star-gated is already open.
 */
export function nextUnlock(states: readonly UnlockInfo[], stars: number): NextUnlock | null {
  for (const s of states) {
    if (s.unlocked || s.premium || s.purchased) continue;
    return { id: s.id, need: s.need, have: stars, missing: Math.max(1, s.need - stars) };
  }
  return null;
}
