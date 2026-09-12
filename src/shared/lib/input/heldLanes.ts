/**
 * Which input slots are held, and which contacts count as taps — pure, no DOM.
 *
 * A held lane is NOT a reason to drop a tap: a second thumb landing on a lane the first thumb
 * has not lifted from yet (rolling double taps, fast streams in one lane, D and S on one lane)
 * is a fresh tap the judge must see. Only a finger *sliding* into a lane is not a tap, and a
 * slide into a lane somebody already holds changes nothing.
 */
export type Contact = 'tap' | 'slide' | 'none';

export class HeldLanes {
  private readonly held: Uint8Array;

  constructor(slots: number) {
    this.held = new Uint8Array(slots);
  }

  isHeld(lane: number): boolean {
    return this.held[lane] === 1;
  }

  /** A contact arrived in `lane`; returns what the game should do with it. */
  press(lane: number, viaMove: boolean): Contact {
    const wasHeld = this.held[lane] === 1;
    this.held[lane] = 1;
    if (!viaMove) return 'tap';
    return wasHeld ? 'none' : 'slide';
  }

  /** The last contact left `lane`; true when it was held. */
  release(lane: number): boolean {
    if (this.held[lane] !== 1) return false;
    this.held[lane] = 0;
    return true;
  }

  clear(): void {
    this.held.fill(0);
  }
}

/**
 * Seconds between an input event and now, for stamping presses with the audio clock. Unknown
 * or implausible time bases (an epoch timestamp, a clock jump) count as "just now" rather than
 * shifting every tap by the cap.
 */
export function eventAge(nowMs: number, eventTimeStampMs: number, maxSec = 0.25): number {
  const age = (nowMs - eventTimeStampMs) / 1000;
  return age >= 0 && age <= maxSec ? age : 0;
}
