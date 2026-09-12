import { SPIN_TAP_REV } from '@/shared/config/constants';

/** Pointer positions closer to the centre than this share of the radius do not turn the spinner (a resting thumb). */
const DEAD_ZONE = 0.12;
/** Window for the displayed spin rate, seconds. */
const RATE_WINDOW = 0.5;

/**
 * Turns pointer motion around a centre into revolutions. Pure, no DOM: the session feeds it the
 * positions of the first pointer that is down and the spinner's centre / radius. Direction does
 * not matter — a consistent circling either way counts — but a jitter back and forth cancels out,
 * so revolutions are the absolute value of the net angle. Key presses and taps add a fixed slice
 * (`tap()`), the keyboard fallback for players without a pointer.
 */
export class SpinTracker {
  /** Net signed angle, radians. */
  private angle = 0;
  private tapped = 0;
  private pointerId: number | null = null;
  private lastTheta = 0;
  private hasTheta = false;
  /** Recent (time, revolutions) samples for the rate display. */
  private readonly samples: { t: number; r: number }[] = [];

  constructor(
    public cx = 0,
    public cy = 0,
    public radius = 1,
  ) {}

  /** Zero the count. A finger already down keeps being tracked (a spinner starts under a circling thumb). */
  reset(): void {
    this.angle = 0;
    this.tapped = 0;
    this.hasTheta = false;
    this.samples.length = 0;
  }

  /** Total revolutions so far (circling + taps). */
  get revolutions(): number {
    return Math.abs(this.angle) / (Math.PI * 2) + this.tapped;
  }

  /** Current angle of the tracked pointer around the centre (radians), for the visual. */
  get theta(): number {
    return this.hasTheta ? this.lastTheta : 0;
  }

  /** A pointer went down: the first one becomes the spinning finger. */
  down(pointerId: number, x: number, y: number, time: number): void {
    if (this.pointerId !== null) return;
    this.pointerId = pointerId;
    this.hasTheta = false;
    this.move(pointerId, x, y, time);
  }

  /** The tracked pointer moved: accumulate the angle it swept around the centre. */
  move(pointerId: number, x: number, y: number, time: number): void {
    if (pointerId !== this.pointerId) return;
    const dx = x - this.cx;
    const dy = y - this.cy;
    if (dx * dx + dy * dy < (DEAD_ZONE * this.radius) ** 2) return;
    const theta = Math.atan2(dy, dx);
    if (this.hasTheta) {
      let d = theta - this.lastTheta;
      if (d > Math.PI) d -= Math.PI * 2;
      else if (d < -Math.PI) d += Math.PI * 2;
      this.angle += d;
      this.sample(time);
    }
    this.lastTheta = theta;
    this.hasTheta = true;
  }

  up(pointerId: number): void {
    if (pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.hasTheta = false;
  }

  /** Keyboard / tap fallback: a fixed slice of a revolution per press. */
  tap(time: number): void {
    this.tapped += SPIN_TAP_REV;
    this.sample(time);
  }

  /** Revolutions per second over the last half second (0 when idle). */
  rate(time: number): number {
    while (this.samples.length && time - this.samples[0].t > RATE_WINDOW) this.samples.shift();
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = last.t - first.t;
    return dt > 0 ? (last.r - first.r) / dt : 0;
  }

  private sample(time: number): void {
    this.samples.push({ t: time, r: this.revolutions });
    while (this.samples.length && time - this.samples[0].t > RATE_WINDOW) this.samples.shift();
  }
}
