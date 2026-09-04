import { CALIBRATION_BPM, CALIBRATION_TAPS, OFFSET_RANGE_MS } from '@/shared/config/constants';
import { clamp, median } from '@/shared/lib/math';

/**
 * Pure tap-collection logic for the latency calibration screen.
 *
 * The metronome clicks at known audio-clock times; each tap is compared with the nearest click.
 * The median of the signed deviations is the player's perceived latency (median rejects the
 * inevitable outliers of the first taps).
 */
export class Calibration {
  readonly deviations: number[] = [];

  constructor(
    readonly bpm = CALIBRATION_BPM,
    readonly taps = CALIBRATION_TAPS,
  ) {}

  get period(): number {
    return 60 / this.bpm;
  }

  get done(): boolean {
    return this.deviations.length >= this.taps;
  }

  /** @param tapTime absolute audio time of the tap, @param firstBeat audio time of beat 0. */
  registerTap(tapTime: number, firstBeat: number): number {
    const rel = tapTime - firstBeat;
    const nearest = Math.round(rel / this.period) * this.period;
    const deviation = rel - nearest;
    if (!this.done) this.deviations.push(deviation);
    return deviation;
  }

  /** Estimated offset in milliseconds, clamped to the settings range. */
  get offsetMs(): number {
    return clamp(Math.round(median(this.deviations) * 1000), OFFSET_RANGE_MS.min, OFFSET_RANGE_MS.max);
  }

  reset(): void {
    this.deviations.length = 0;
  }
}
