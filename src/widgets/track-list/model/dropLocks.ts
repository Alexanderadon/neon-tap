import { dropState, type DropState, type TrackMeta } from '@/entities/track';

export interface DropLockContext {
  nowMs: number;
  purchased: readonly string[];
  /** NEON PASS is active (read by the widget: `entities/track` never reads the pass). */
  pass: boolean;
  unlockAll: boolean;
}

/** The lock of every weekly track by id — kept apart from the road's unlocks, and looked up first. */
export function dropLocks(drops: readonly Pick<TrackMeta, 'id' | 'release'>[], ctx: DropLockContext): Map<string, DropState> {
  return new Map(drops.map((t) => [t.id, dropState(t, { nowMs: ctx.nowMs, owned: ctx.purchased.includes(t.id), pass: ctx.pass, unlockAll: ctx.unlockAll })]));
}

/** NEON PASS: the weekly tracks in the deck the player does not own yet — written to `purchased` when the menu opens. */
export function passDropGrants(catalog: readonly Pick<TrackMeta, 'id' | 'drop'>[], purchased: readonly string[], pass: boolean): string[] {
  if (!pass) return [];
  return catalog.filter((t) => t.drop === true && !purchased.includes(t.id)).map((t) => t.id);
}
