/**
 * Pure gesture arithmetic for the menus (the game field has its own input path).
 * Kept free of DOM so the rules are testable: a quick flick travels several cards, a slow drag
 * one; a swipe that starts at the left edge and goes right means "back".
 */

/** Minimum drag to flip one card, px. */
export const SWIPE_PX = 56;
/** Velocity (px/s) that makes a flick travel one extra card; capped. */
const FLICK_STEP = 700;
const FLICK_MAX = 10;

/**
 * How many cards a release should travel: 0 when the drag was too short and slow, otherwise
 * 1 plus one per FLICK_STEP px/s of velocity (sign = direction: positive = to the next card).
 */
export function flickCards(dx: number, velocity: number): number {
  const fast = Math.abs(velocity) >= FLICK_STEP * 0.6;
  if (Math.abs(dx) < SWIPE_PX && !fast) return 0;
  const dir = Math.abs(dx) >= SWIPE_PX ? -Math.sign(dx) : -Math.sign(velocity);
  const extra = Math.min(FLICK_MAX - 1, Math.floor(Math.max(0, Math.abs(velocity) - FLICK_STEP * 0.6) / FLICK_STEP));
  return dir * (1 + extra);
}

/** Pointer velocity from the last two samples, px/s (0 when the samples coincide in time). */
export function velocityOf(prev: { x: number; t: number }, cur: { x: number; t: number }): number {
  const dt = cur.t - prev.t;
  return dt > 0 ? ((cur.x - prev.x) / dt) * 1000 : 0;
}

/** Edge width where a rightward swipe means "back", px. */
export const BACK_EDGE_PX = 28;
/** Distance a back swipe has to travel, px. */
export const BACK_PX = 80;

/**
 * "Back" gesture: starts within BACK_EDGE_PX of the left edge, travels ≥ BACK_PX to the right
 * and stays mostly horizontal.
 */
export function isBackSwipe(start: { x: number; y: number }, end: { x: number; y: number }): boolean {
  const dx = end.x - start.x;
  const dy = Math.abs(end.y - start.y);
  return start.x <= BACK_EDGE_PX && dx >= BACK_PX && dy < dx * 0.6;
}
