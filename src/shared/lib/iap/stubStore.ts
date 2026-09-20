import { devFlagValue } from '@/shared/config/devFlags';
import { NBSP } from '@/shared/lib/format';
import type { BuyOutcome, Sku, Store } from './types';

/** How long the stub "processes" a payment (ms). */
export const STUB_PROCESSING_MS = 1500;

/** Placeholder prices in rubles — the real store returns its own localized strings. */
export const STUB_PRICES_RUB: Readonly<Record<Sku, number>> = {
  'crystals-s': 99,
  'crystals-m': 249,
  'crystals-l': 499,
  'limited-48h': 249,
  'music-8': 299,
};

/** «249 ₽» — a no-break space before the sign, as every unit in the design system. */
export function rubles(n: number): string {
  return `${n}${NBSP}₽`;
}

/** Injectable timer so the stub is testable without real timers. */
export interface StoreClock {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const realClock: StoreClock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** `?iap=off` in the page URL makes the stub unavailable (the popups are then never offered). Safe outside the browser. */
export function iapOffFlag(): boolean {
  return devFlagValue('iap') === 'off';
}

/**
 * Development provider: every product is "bought" after `STUB_PROCESSING_MS` and resolves `'ok'`.
 * `processing` (with `subscribe()`) lets the buy button show its waiting state meanwhile, and
 * `cancel()` resolves `'cancel'` early (a close during the fake payment).
 */
export class StubStore implements Store {
  private current: { sku: Sku; resolve: (o: BuyOutcome) => void; timer: unknown } | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly clock: StoreClock;
  private readonly off: () => boolean;
  private readonly delayMs: number;

  constructor(opts: { clock?: StoreClock; off?: () => boolean; delayMs?: number } = {}) {
    this.clock = opts.clock ?? realClock;
    this.off = opts.off ?? iapOffFlag;
    this.delayMs = opts.delayMs ?? STUB_PROCESSING_MS;
  }

  available(): boolean {
    return !this.off();
  }

  price(sku: Sku): string {
    return rubles(STUB_PRICES_RUB[sku]);
  }

  /** The product whose fake payment runs right now, or null. */
  get processing(): Sku | null {
    return this.current?.sku ?? null;
  }

  /** Notified when a purchase starts or ends. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  buy(sku: Sku): Promise<BuyOutcome> {
    if (!this.available() || this.current) return Promise.resolve('failed');
    return new Promise<BuyOutcome>((resolve) => {
      const timer = this.clock.setTimeout(() => this.finish('ok'), this.delayMs);
      this.current = { sku, resolve, timer };
      this.emit();
    });
  }

  /** The player backed out while the stub was "processing": no goods. */
  cancel(): void {
    if (this.current) this.finish('cancel');
  }

  private finish(outcome: BuyOutcome): void {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    this.clock.clearTimeout(cur.timer);
    cur.resolve(outcome);
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}
