import { INPUT_SLOTS } from '@/shared/config/constants';
import { PointerLanes } from './PointerLanes';
import { HeldLanes, eventAge } from './heldLanes';

export interface LaneEvent {
  lane: number;
  /** Absolute audio-clock time of the press/release. */
  audioTime: number;
  /** True when the event comes from a finger sliding between lanes (not a fresh tap). */
  viaMove?: boolean;
}

/** Raw pointer position (client coordinates) of a finger / mouse that is down on the field. */
export interface PointerEventInfo {
  pointerId: number;
  x: number;
  y: number;
  audioTime: number;
}

export interface InputHandlers {
  onPress: (e: LaneEvent) => void;
  onRelease: (e: LaneEvent) => void;
  /** Every pointer that is down, as it lands and moves — for the spinner, which reads motion, not lanes. */
  onPointerDown?: (e: PointerEventInfo) => void;
  onPointerMove?: (e: PointerEventInfo) => void;
  onPointerUp?: (e: PointerEventInfo) => void;
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
 * with `viaMove` set, which is how slide notes are followed. Which pointer is in which lane
 * (multi-touch, slides, cancel) is the pure `PointerLanes` module, and which contacts count as
 * taps is the pure `HeldLanes` module; this class only adds the DOM listeners and the audio-time
 * stamps.
 */
export class Input {
  private readonly held = new HeldLanes(INPUT_SLOTS);
  private readonly keyLane = new Map<string, number>();
  /** Audio time of the pointer event being dispatched (set before PointerLanes calls back). */
  private pointerTime = 0;
  private readonly pointers = new PointerLanes({
    press: (lane, viaMove) => this.press(lane, this.pointerTime, viaMove),
    release: (lane, viaMove) => this.release(lane, this.pointerTime, viaMove),
  });
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
    this.held.clear();
    this.keyLane.clear();
    this.pointers.clear();
  }

  isHeld(lane: number): boolean {
    return this.held.isHeld(lane);
  }

  private eventAudioTime(e: Event): number {
    return this.opts.audioNow() - eventAge(performance.now(), e.timeStamp);
  }

  private press(lane: number, audioTime: number, viaMove = false): void {
    const contact = this.held.press(lane, viaMove);
    if (contact === 'none') return;
    this.handlers?.onPress({ lane, audioTime, viaMove: contact === 'slide' });
  }

  private release(lane: number, audioTime: number, viaMove = false): void {
    if (!this.held.release(lane)) return;
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
    this.pointerTime = this.eventAudioTime(e);
    this.pointers.down(e.pointerId, this.opts.laneAt(e.clientX, e.clientY));
    this.handlers?.onPointerDown?.({ pointerId: e.pointerId, x: e.clientX, y: e.clientY, audioTime: this.pointerTime });
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.pointers.laneOf(e.pointerId) < 0) return; // hover / untracked finger
    e.preventDefault();
    this.pointerTime = this.eventAudioTime(e);
    this.pointers.move(e.pointerId, this.opts.laneAt(e.clientX, e.clientY));
    this.handlers?.onPointerMove?.({ pointerId: e.pointerId, x: e.clientX, y: e.clientY, audioTime: this.pointerTime });
  };

  /** pointerup and pointercancel (browser took the touch: scroll gesture, incoming call, palm) both lift the finger. */
  private onPointerUp = (e: PointerEvent): void => {
    e.preventDefault();
    this.pointerTime = this.eventAudioTime(e);
    this.pointers.up(e.pointerId);
    this.handlers?.onPointerUp?.({ pointerId: e.pointerId, x: e.clientX, y: e.clientY, audioTime: this.pointerTime });
  };

  private releaseAll = (): void => {
    const t = this.opts.audioNow();
    for (let lane = 0; lane < INPUT_SLOTS; lane++) this.release(lane, t);
    this.keyLane.clear();
    this.pointers.clear();
  };
}

function prevent(e: Event): void {
  e.preventDefault();
}
