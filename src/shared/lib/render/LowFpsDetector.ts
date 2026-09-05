/**
 * Watches the FPS meter and fires once when the frame rate has stayed below a threshold for a
 * sustained period — the trigger for the automatic "economy" FX level on weak phones.
 *
 * Samples of 0 (the meter has not produced its first window yet) are ignored; any sample at or
 * above the threshold resets the streak, so a single hitch never triggers it. Fires once only.
 */
export class LowFpsDetector {
  private below = 0;
  /** True once the detector has fired. */
  triggered = false;

  constructor(
    readonly thresholdFps = 45,
    readonly holdSec = 3,
  ) {}

  /** Feed the current averaged FPS and the frame delta. Returns true exactly on the frame it fires. */
  tick(fps: number, dtSec: number): boolean {
    if (this.triggered || fps <= 0) return false;
    if (fps >= this.thresholdFps) {
      this.below = 0;
      return false;
    }
    this.below += dtSec;
    if (this.below < this.holdSec) return false;
    this.triggered = true;
    return true;
  }

  /** Seconds the frame rate has been continuously below the threshold. */
  get belowSec(): number {
    return this.below;
  }

  reset(): void {
    this.below = 0;
    this.triggered = false;
  }
}
