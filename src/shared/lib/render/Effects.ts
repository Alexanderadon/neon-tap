/** Screen shake — amplitude ≤ 4 px, exponential decay. Only on combo milestones and misses. */
export class ScreenShake {
  private amplitude = 0;
  private time = 0;
  offsetX = 0;
  offsetY = 0;

  trigger(amplitude: number): void {
    this.amplitude = Math.min(4, Math.max(this.amplitude, amplitude));
    this.time = 0;
  }

  update(dt: number): void {
    if (this.amplitude <= 0.05) {
      this.amplitude = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }
    this.time += dt;
    const decay = Math.exp(-this.time * 12);
    const a = this.amplitude * decay;
    this.offsetX = Math.sin(this.time * 90) * a;
    this.offsetY = Math.cos(this.time * 70) * a;
    if (decay < 0.05) this.amplitude = 0;
  }
}

/** Per-lane flash timers (seconds since the flash started, or -1). */
export class LaneFlash {
  readonly age: Float32Array;

  constructor(lanes: number, readonly duration = 0.08) {
    this.age = new Float32Array(lanes).fill(-1);
  }

  trigger(lane: number): void {
    this.age[lane] = 0;
  }

  update(dt: number): void {
    for (let i = 0; i < this.age.length; i++) {
      if (this.age[i] < 0) continue;
      this.age[i] += dt;
      if (this.age[i] > this.duration) this.age[i] = -1;
    }
  }

  /** 1 at the start of the flash, 0 when finished. */
  intensity(lane: number): number {
    const a = this.age[lane];
    return a < 0 ? 0 : 1 - a / this.duration;
  }
}

/** Rolling FPS meter based on rAF deltas (drawing only — never used for game logic). */
export class FpsMeter {
  private frames = 0;
  private acc = 0;
  fps = 0;
  /** Worst frame time in the last window, ms. */
  worstMs = 0;
  private worstAcc = 0;

  tick(dtSec: number): void {
    this.frames++;
    this.acc += dtSec;
    this.worstAcc = Math.max(this.worstAcc, dtSec * 1000);
    if (this.acc >= 0.5) {
      this.fps = Math.round(this.frames / this.acc);
      this.worstMs = Math.round(this.worstAcc * 10) / 10;
      this.frames = 0;
      this.acc = 0;
      this.worstAcc = 0;
    }
  }
}
