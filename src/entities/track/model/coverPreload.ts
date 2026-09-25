import { coverImage } from './cover';

/** Pictures fetched at once in the background. */
const PARALLEL = 2;

const settled = new Set<string>();
const running = new Map<string, Promise<void>>();
let queue: string[] = [];

/**
 * Fetch and decode one track's picture so its card paints at once. Never rejects: a picture that
 * does not load leaves the card to its procedural art.
 */
export function preloadCover(id: string): Promise<void> {
  if (settled.has(id)) return Promise.resolve();
  const busy = running.get(id);
  if (busy) return busy;
  const url = coverImage(id);
  if (!url || typeof Image === 'undefined') {
    settled.add(id);
    return Promise.resolve();
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  // Wait for the bytes only: decode() of a detached image can wait for the next rendered frame, which a
  // page that is not painting (a background tab) never produces — the boot splash then sat at its cap.
  // The decode is still started, in the background, so the card paints at once when it mounts.
  const loaded = new Promise((resolve, reject) => {
    img.onload = () => {
      if (typeof img.decode === 'function') void img.decode().catch(() => undefined);
      resolve(undefined);
    };
    img.onerror = reject;
  });
  const p = loaded
    .catch(() => undefined)
    .then(() => {
      settled.add(id);
      running.delete(id);
      pump();
    });
  running.set(id, p);
  return p;
}

/**
 * Keep the pictures ahead of the player: `ids` in this order (nearest card first), PARALLEL at a
 * time, in the background — a swipe never lands on an empty card. A new call replaces the order.
 */
export function prioritizeCovers(ids: readonly string[]): void {
  const seen = new Set<string>();
  queue = ids.filter((id) => {
    if (settled.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  pump();
}

function pump(): void {
  while (running.size < PARALLEL && queue.length) {
    const id = queue.shift()!;
    if (!settled.has(id) && !running.has(id)) void preloadCover(id);
  }
}

/** `ids` by distance from `index` — the card itself, then +1, −1, +2, −2 … — up to `radius` away. */
export function idsAround(ids: readonly string[], index: number, radius: number): string[] {
  const out: string[] = [];
  if (index < 0 || index >= ids.length) return out;
  out.push(ids[index]);
  for (let d = 1; d <= radius; d++) {
    if (index + d < ids.length) out.push(ids[index + d]);
    if (index - d >= 0) out.push(ids[index - d]);
  }
  return out;
}
