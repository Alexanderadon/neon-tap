import { KEY_BINDINGS, LANE_COUNT } from '@/shared/config/constants';

export interface LaneEvent {
  lane: number;
  /** Absolute audio-clock time of the press/release. */
  audioTime: number;
}

export interface InputHandlers {
  onPress: (e: LaneEvent) => void;
  onRelease: (e: LaneEvent) => void;
}

interface Options {
  /** Returns the current audio-clock time. */
  audioNow: () => number;
  /** Maps a pointer position to a lane index (or -1). */
  laneAt: (x: number, y: number) => number;
}

/**
 * Keyboard (D F J K / arrows) + pointer input, normalised to lane events stamped with audio time.
 *
 * Event timestamps are converted from `performance.now()` domain to the audio clock, which
 * compensates for the delay between the physical key press and the JS handler running.
 */
export class Input {
  private readonly held = new Uint8Array(LANE_COUNT);
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
    this.target.removeEventListener('pointerup', this.onPointerUp);
    this.target.removeEventListener('pointercancel', this.onPointerUp);
    this.target.removeEventListener('contextmenu', prevent);
    this.target = null;
    this.handlers = null;
    this.held.fill(0);
    this.pointerLane.clear();
  }

  isHeld(lane: number): boolean {
    return this.held[lane] === 1;
  }

  private eventAudioTime(e: Event): number {
    const ageSec = Math.max(0, (performance.now() - e.timeStamp) / 1000);
    return this.opts.audioNow() - Math.min(ageSec, 0.1);
  }

  private press(lane: number, audioTime: number): void {
    if (this.held[lane]) return;
    this.held[lane] = 1;
    this.handlers?.onPress({ lane, audioTime });
  }

  private release(lane: number, audioTime: number): void {
    if (!this.held[lane]) return;
    this.held[lane] = 0;
    this.handlers?.onRelease({ lane, audioTime });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const lane = KEY_BINDINGS[e.code];
    if (lane === undefined) return;
    e.preventDefault();
    if (e.repeat) return;
    this.press(lane, this.eventAudioTime(e));
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const lane = KEY_BINDINGS[e.code];
    if (lane === undefined) return;
    e.preventDefault();
    this.release(lane, this.eventAudioTime(e));
  };

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    const lane = this.opts.laneAt(e.clientX, e.clientY);
    if (lane < 0) return;
    this.pointerLane.set(e.pointerId, lane);
    this.press(lane, this.eventAudioTime(e));
  };

  private onPointerUp = (e: PointerEvent): void => {
    e.preventDefault();
    const lane = this.pointerLane.get(e.pointerId);
    if (lane === undefined) return;
    this.pointerLane.delete(e.pointerId);
    // Another pointer may still hold the same lane (two thumbs).
    for (const l of this.pointerLane.values()) if (l === lane) return;
    this.release(lane, this.eventAudioTime(e));
  };

  private releaseAll = (): void => {
    const t = this.opts.audioNow();
    for (let lane = 0; lane < LANE_COUNT; lane++) this.release(lane, t);
    this.pointerLane.clear();
  };
}

function prevent(e: Event): void {
  e.preventDefault();
}
