import { flickCards } from '@/shared/lib/input/gestures';

/**
 * Deck motion, kept out of React: a continuous position in cards, driven by the finger while
 * dragging and by a timed flight after release. The view layer only asks `pos()` each frame and
 * writes transforms; React re-renders when the centre card changes.
 */

/** Cards further than this from the centre are not drawn. */
export const WINDOW = 2;

/** Rubber band past either end: a third of the overshoot. */
export function rubberBand(raw: number, n: number): number {
  if (raw < 0) return raw / 3;
  if (raw > n - 1) return n - 1 + (raw - (n - 1)) / 3;
  return raw;
}

/** Flight length in ms: short for a flip, longer (but bounded) for a long flick. */
export function flightDuration(distance: number): number {
  return Math.min(760, 240 + 70 * Math.abs(distance));
}

/** Quartic ease-out: fast start, long soft landing — the feel of a spinning deck coming to rest. */
export function easeOut(k: number): number {
  const c = Math.max(0, Math.min(1, k));
  return 1 - (1 - c) ** 4;
}

/** Where a release ends: a flick's card count from the gesture, else the nearest card. */
export function releaseTarget(index: number, pos: number, dx: number, velocity: number, n: number): number {
  const cards = flickCards(dx, velocity);
  const to = cards !== 0 ? index + cards : Math.round(pos);
  return Math.max(0, Math.min(n - 1, to));
}

/** How a card at `rel` cards from the centre is drawn. */
export function cardStyle(rel: number): { x: number; scale: number; opacity: number; z: number } {
  const away = Math.min(1, Math.abs(rel));
  return { x: rel * 84, scale: 1 - 0.12 * away, opacity: 1 - 0.45 * away, z: 10 - Math.round(Math.abs(rel)) };
}

export class DeckMotion {
  private current: number;
  private from = 0;
  private to = 0;
  private start = 0;
  private duration = 0;
  private flying = false;

  constructor(index: number) {
    this.current = index;
  }

  pos(): number {
    return this.current;
  }

  isFlying(): boolean {
    return this.flying;
  }

  /** The finger owns the position: no flight, position set directly (already rubber-banded by the caller). */
  drag(pos: number): void {
    this.flying = false;
    this.current = pos;
  }

  /** Start a flight to a card at time `now` (ms). */
  fly(to: number, now: number): void {
    this.from = this.current;
    this.to = to;
    this.start = now;
    this.duration = flightDuration(to - this.current);
    this.flying = Math.abs(to - this.current) > 1e-4;
    if (!this.flying) this.current = to;
  }

  /** Advance to time `now`; returns true while still moving. */
  step(now: number): boolean {
    if (!this.flying) return false;
    const k = (now - this.start) / this.duration;
    if (k >= 1) {
      this.current = this.to;
      this.flying = false;
      return false;
    }
    this.current = this.from + (this.to - this.from) * easeOut(k);
    return true;
  }
}
