/** `#rrggbb` (or `#rgb`) → `rgba(r, g, b, a)`; anything else falls back to the given colour untouched. */
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** The focused card's glow: the cover's accent at 30 % under the usual card drop (spec §1.5). */
export function cardGlow(accent: string): string {
  return `0 24px 60px rgba(0, 0, 0, 0.55), 0 0 48px ${hexToRgba(accent, 0.3)}`;
}
