export interface PointerLaneHandlers {
  /** A lane gained a finger. `viaMove` = the finger slid in from another lane (not a fresh tap). */
  press: (lane: number, viaMove: boolean) => void;
  /** A lane lost its last finger. `viaMove` = the finger slid away (not a lift). */
  release: (lane: number, viaMove: boolean) => void;
}

/**
 * Pure pointer → lane bookkeeping (no DOM). Tracks which lane every active pointer is in and
 * turns pointer down / move / up / cancel into lane press / release events:
 *  - two fingers on one lane press it once and release it only when the last one lifts,
 *  - a finger sliding across zones releases the old lane and presses the new one with `viaMove`
 *    (this is how slide notes are followed and why a slide never counts as a new tap),
 *  - a move into a lane another finger already holds only releases the old lane,
 *  - pointercancel is treated exactly like pointerup (the browser stole the touch: a lift, not a slide),
 *  - a pointer that landed outside every lane (-1) is ignored — its later moves/ups do nothing.
 * No allocations per event: the map is reused and results go straight to the handlers.
 */
export class PointerLanes {
  private readonly lanes = new Map<number, number>();

  constructor(private readonly handlers: PointerLaneHandlers) {}

  /** Number of tracked (pressed-in-a-lane) pointers. */
  get active(): number {
    return this.lanes.size;
  }

  /** Lane currently under this pointer, or -1 when untracked. */
  laneOf(pointerId: number): number {
    return this.lanes.get(pointerId) ?? -1;
  }

  /** Pointer went down at `lane` (-1 = outside any lane). Returns true when the pointer is now tracked. */
  down(pointerId: number, lane: number): boolean {
    if (this.lanes.has(pointerId)) this.up(pointerId); // stale id (missed pointerup) — lift first
    if (lane < 0) return false;
    this.lanes.set(pointerId, lane);
    this.handlers.press(lane, false);
    return true;
  }

  /** Pointer moved to `lane`. Returns true when it changed lanes. A move to -1 keeps the old lane. */
  move(pointerId: number, lane: number): boolean {
    const old = this.lanes.get(pointerId);
    if (old === undefined || lane < 0 || lane === old) return false;
    this.lanes.set(pointerId, lane);
    if (!this.othersHold(old, pointerId)) this.handlers.release(old, true);
    this.handlers.press(lane, true);
    return true;
  }

  /** Pointer lifted or was cancelled. Returns true when it was tracked. */
  up(pointerId: number): boolean {
    const lane = this.lanes.get(pointerId);
    if (lane === undefined) return false;
    this.lanes.delete(pointerId);
    if (!this.othersHold(lane, pointerId)) this.handlers.release(lane, false);
    return true;
  }

  /** Forget every pointer without emitting (the caller releases all lanes itself, e.g. on blur). */
  clear(): void {
    this.lanes.clear();
  }

  private othersHold(lane: number, exceptId: number): boolean {
    for (const [id, l] of this.lanes) if (id !== exceptId && l === lane) return true;
    return false;
  }
}
