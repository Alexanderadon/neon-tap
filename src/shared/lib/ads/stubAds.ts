import type { AdOutcome, AdPlacement, RewardedAd } from './types';

/** How long the stub "ad" runs (seconds), and the short form for development (`?ads=fast`). */
export const AD_SECONDS = 30;
export const AD_SECONDS_FAST = 3;

/** Injectable time source so the stub is testable without real timers. */
export interface AdClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const realClock: AdClock = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** `?ads=fast` in the page URL shortens the stub to three seconds. Safe outside the browser. */
export function adsFastFlag(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    return new URLSearchParams(window.location.search).get('ads') === 'fast';
  } catch {
    return false;
  }
}

/**
 * Development provider: "plays" an ad for `AD_SECONDS` and resolves `'rewarded'`. Exposes the
 * playback progress (0..1) and a subscription so a countdown UI (RingCountdown) can follow it,
 * and `cancel()` so a close button resolves `'closed'` without a reward.
 */
export class StubAds implements RewardedAd {
  private startedAt = 0;
  private durationMs = 0;
  private timer: unknown = null;
  private resolveCurrent: ((o: AdOutcome) => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly clock: AdClock;
  private readonly seconds: () => number;

  constructor(opts: { seconds?: () => number; clock?: AdClock } = {}) {
    this.clock = opts.clock ?? realClock;
    this.seconds = opts.seconds ?? (() => (adsFastFlag() ? AD_SECONDS_FAST : AD_SECONDS));
  }

  available(): boolean {
    return true;
  }

  /** Whether an ad is playing right now. */
  get playing(): boolean {
    return this.resolveCurrent !== null;
  }

  /** Duration of the current ad in seconds (0 when nothing plays). */
  get durationSeconds(): number {
    return this.playing ? this.durationMs / 1000 : 0;
  }

  /** Playback progress 0..1 (0 when nothing plays). */
  progress(): number {
    if (!this.playing || this.durationMs <= 0) return 0;
    return Math.max(0, Math.min(1, (this.clock.now() - this.startedAt) / this.durationMs));
  }

  /** Seconds left in the current ad (0 when nothing plays). */
  remainingSeconds(): number {
    if (!this.playing) return 0;
    return Math.max(0, (this.durationMs * (1 - this.progress())) / 1000);
  }

  /** Notified when an ad starts or ends. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  show(_placement: AdPlacement): Promise<AdOutcome> {
    if (this.playing) return Promise.resolve('failed');
    this.durationMs = this.seconds() * 1000;
    this.startedAt = this.clock.now();
    return new Promise<AdOutcome>((resolve) => {
      this.resolveCurrent = resolve;
      this.timer = this.clock.setTimeout(() => this.finish('rewarded'), this.durationMs);
      this.emit();
    });
  }

  /** The player closed the ad early: no reward. */
  cancel(): void {
    if (this.playing) this.finish('closed');
  }

  private finish(outcome: AdOutcome): void {
    const resolve = this.resolveCurrent;
    this.resolveCurrent = null;
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
    resolve?.(outcome);
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}
