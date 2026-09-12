/**
 * "Not now" memory of the install banner — the pure part. The value in `localStorage` is a
 * millisecond timestamp as a decimal string; anything else (old formats, garbage) reads as
 * "never dismissed" so a corrupted key can only make the banner show again, never hide forever.
 */
export const INSTALL_DISMISSED_KEY = 'neon-tap:install-dismissed';

/** Parse the stored value → timestamp or `null`. */
export function parseDismissedAt(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (!/^\d{1,16}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Serialise a timestamp for storage (integer milliseconds). */
export function serializeDismissedAt(now: number): string {
  if (!Number.isFinite(now) || now <= 0) throw new Error(`dismissal: bad timestamp ${now}`);
  return String(Math.floor(now));
}
