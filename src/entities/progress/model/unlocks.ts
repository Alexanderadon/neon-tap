/** The first N catalog positions (easiest songs) are always playable. */
export const ALWAYS_OPEN = 5;
/** Threshold growth per catalog position past the free ones. */
export const STARS_PER_POSITION = 2.2;
/** The hardest track must open before the very last stars: cap = max stars − this. */
export const THRESHOLD_HEADROOM = 6;
/** Stars a single track can yield (pass / A / S). */
export const STARS_PER_TRACK = 3;

/**
 * Stars needed to open the track at `position` (0-based, easiest first) in a catalog of
 * `catalogSize` songs: 0 for the first ALWAYS_OPEN, then round((position − 4) · 2.2), never above
 * `catalogSize · 3 − 6` so the last song opens before the player has to perfect everything.
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
  /** Stars required (0 when free); meaningless for premium tracks. */
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

/** Unlock state for every catalog track, in catalog order. */
export function unlockStates(catalogIds: readonly string[], ctx: UnlockContext): UnlockInfo[] {
  return catalogIds.map((id, i) => {
    const need = unlockThreshold(i, catalogIds.length);
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
  return isOpen(unlockThreshold(i, catalogIds.length), premium, purchased, id === ctx.dailyId, ctx);
}

/**
 * Ids that are open with `after` stars but were locked with `before` (the daily track never
 * "unlocks"; premium tracks never open by stars, so they are skipped too).
 */
export function newlyUnlocked(catalogIds: readonly string[], before: number, after: number, premium: readonly string[] = []): string[] {
  const out: string[] = [];
  if (after <= before) return out;
  catalogIds.forEach((id, i) => {
    if (premium.includes(id)) return;
    const need = unlockThreshold(i, catalogIds.length);
    if (before < need && after >= need) out.push(id);
  });
  return out;
}
