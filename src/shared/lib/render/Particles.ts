/**
 * Fixed-size particle pool stored as typed arrays (structure of arrays).
 * No allocations in the frame loop: emit() reuses dead slots, update() is a flat loop.
 */
export class ParticlePool {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly life: Float32Array; // remaining seconds
  readonly maxLife: Float32Array;
  readonly size: Float32Array;
  readonly color: Uint8Array; // index into a palette
  private cursor = 0;
  alive = 0;
  /** Multiplier applied to every emit() count — the "economy" FX level halves it (0.5). */
  emitScale = 1;

  constructor(readonly capacity: number) {
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.color = new Uint8Array(capacity);
  }

  emit(x: number, y: number, count: number, color: number, speed: number, sizePx: number, lifeSec = 0.5): void {
    const n0 = this.emitScale === 1 ? count : Math.max(1, Math.round(count * this.emitScale));
    for (let n = 0; n < n0; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      if (this.life[i] <= 0) this.alive++;
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = Math.cos(angle) * v;
      this.vy[i] = Math.sin(angle) * v - speed * 0.4;
      this.life[i] = lifeSec * (0.6 + Math.random() * 0.6);
      this.maxLife[i] = this.life[i];
      this.size[i] = sizePx * (0.5 + Math.random());
      this.color[i] = color;
    }
  }

  update(dt: number, gravity = 900): void {
    let alive = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      this.vy[i] += gravity * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      alive++;
    }
    this.alive = alive;
  }

  clear(): void {
    this.life.fill(0);
    this.alive = 0;
  }
}
