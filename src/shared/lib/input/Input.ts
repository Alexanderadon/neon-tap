import { INPUT_SLOTS } from '@/shared/config/constants';

export interface LaneEvent {
  lane: number;
  /** Absolute audio-clock time of the press/release. */
  audioTime: number;
  /** True when the event comes from a finger sliding between lanes (not a fresh tap). */
  viaMove?: boolean;
}

export interface InputHandlers {
  onPress: (e: LaneEvent) => void;
  onRelease: (e: LaneEvent) => void;
}

interface Options {
  /** Returns the current audio-clock time. */
  audioNow: () => number;
  /** Maps a key code to a lane index (or -1) — depends on the active lane count. */
  laneForKey: (code: string) => number;
  /** Maps a pointer position to a lane index (or -1). */
  laneAt: (x: number, y: number) => number;
}

/**
 * Keyboard + pointer input, normalised to lane events stamped with audio time.
 *
 * Event timestamps are converted from `performance.now()` domain to the audio clock, which
 * compensates for the delay between the physical key press and the JS handler running.
 * Key → lane mapping is delegated so the playfield can change its lane count mid-song.
 * A finger that slides into another lane releases the old lane and presses the new one
 * with `viaMove` set, which is how slide notes are followed.
 */
export class Input {
  private readonly held = new Uint8Array(INPUT_SLOTS);
  private readonly keyLane = new Map<string, number>();
  private readonly pointerLane = new Map<number, number>();
  private target: HTMLElement | null = null;
  private handlers: InputHandlers | null = null;

  constructor(private readonly opts: Options) {}

  attach(target: HTMLElement, handlers: InputHandlers): void {
    this.detach();
    this.target = target;
    this.handlers = handlers;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    target.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    target.addEventListener('pointermove', this.onPointerMove, { passive: false });
    target.addEventListener('pointerup', this.onPointerUp, { passive: false });
    target.addEventListener('pointercancel', this.onPointerUp, { passive: false });
    target.addEventListener('contextmenu', prevent);
  }

  detach(): void {
    if (!this.target) return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.releaseAll);
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('pointermove', this.onPointerMove);
    this.target.removeEventListener('pointerup', this.onPointerUp);
    this.target.removeEventListener('pointercancel', this.onPointerUp);
    this.target.removeEventListener('contextmenu', prevent);
    this.target = null;
    this.handlers = null;
    this.held.fill(0);
    this.keyLane.clear();
    this.pointerLane.clear();
  }

  isHeld(lane: number): boolean {
    return this.held[lane] === 1;
  }

  private eventAudioTime(e: Event): number {
    const ageSec = Math.max(0, (performance.now() - e.timeStamp) / 1000);
    return this.opts.audioNow() - Math.min(ageSec, 0.1);
  }

  private press(lane: number, audioTime: number, viaMove = false): void {
    if (this.held[lane]) return;
    this.held[lane] = 1;
    this.handlers?.onPress({ lane, audioTime, viaMove });
  }

  private release(lane: number, audioTime: number, viaMove = false): void {
    if (!this.held[lane]) return;
    this.held[lane] = 0;
    this.handlers?.onRelease({ lane, audioTime, viaMove });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const lane = this.opts.laneForKey(e.code);
    if (lane < 0) return;
    e.preventDefault();
    if (e.repeat || this.keyLane.has(e.code)) return;
    // Remember which lane this physical key took, so keyup releases the right lane even if
    // the lane count changed while the key was down.
    this.keyLane.set(e.code, lane);
    this.press(lane, this.eventAudioTime(e));
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const lane = this.keyLane.get(e.code);
    if (lane === undefined) return;
    e.preventDefault();
    this.keyLane.delete(e.code);
    for (const l of this.keyLane.values()) if (l === lane) return; // another key still holds this lane
    this.release(lane, this.eventAudioTime(e));
  };

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    const lane = this.opts.laneAt(e.clientX, e.clientY);
    if (lane < 0) return;
    this.pointerLane.set(e.pointerId, lane);
    this.press(lane, this.eventAudioTime(e));
  };

  private onPointerMove = (e: PointerEvent): void => {
    const old = this.pointerLane.get(e.pointerId);
    if (old === undefined) return;
    e.preventDefault();
    const lane = this.opts.laneAt(e.clientX, e.clientY);
    if (lane < 0 || lane === old) return;
    this.pointerLane.set(e.pointerId, lane);
    const t = this.eventAudioTime(e);
    let stillHeld = false;
    for (const l of this.pointerLane.values()) if (l === old) stillHeld = true;
    if (!stillHeld) this.release(old, t, true);
    this.press(lane, t, true);
  };

  private onPointerUp = (e: PointerEvent): void => {
    e.preventDefault();
    const lane = this.pointerLane.get(e.pointerId);
    if (lane === undefined) return;
    this.pointerLane.delete(e.pointerId);
    for (const l of this.pointerLane.values()) if (l === lane) return; // two thumbs on one lane
    this.release(lane, this.eventAudioTime(e));
  };

  private releaseAll = (): void => {
    const t = this.opts.audioNow();
    for (let lane = 0; lane < INPUT_SLOTS; lane++) this.release(lane, t);
    this.keyLane.clear();
    this.pointerLane.clear();
  };
}

function prevent(e: Event): void {
  e.preventDefault();
}
