/**
 * Number formatting of the design system, one definition for every screen: the thin-space
 * thousands of the wallet chips and the score («102 400»), the Russian per cent («98,6 %»),
 * the volume labels of the settings and the avatar letter.
 */

/** U+2009, the thin space between thousands (kept as a code so editors never swap it for a plain space). */
export const THIN_SPACE = String.fromCharCode(0x2009);

/** U+00A0, the no-break space before a unit sign. */
export const NBSP = String.fromCharCode(0xa0);

/** «102 400»: thousands separated by a thin space, rounded, a proper minus for negatives. */
export function formatCount(n: number): string {
  const digits = String(Math.abs(Math.round(n)));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
  return n < 0 ? `−${grouped}` : grouped;
}

/** The score is written the same way as the wallet counters. */
export const formatScore = formatCount;

/** «+35» / «−12» badge text next to a counter. */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${formatCount(delta)}` : formatCount(delta);
}

/** «98,6 %»: one decimal, a comma, a space before the sign (0..1 in). */
export function formatAccuracy(accuracy: number): string {
  return `${(accuracy * 100).toFixed(1).replace('.', ',')} %`;
}

/** Volume sliders move in 5 % steps (screens-onboard: SliderRow «шаг 5 %»). */
export const VOLUME_STEP = 0.05;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/** 0..1 → whole per cent, clamped (the slider's fill width and the value column). */
export function volumePercent(v: number): number {
  return Math.round(clamp01(v) * 100);
}

/** «90 %» — a no-break space before the sign so the 56 px value column never wraps. */
export function percentLabel(v: number): string {
  return `${volumePercent(v)}${NBSP}%`;
}

/** The avatar letter: first character of the name, upper-cased; «?» while there is no name. */
export function initialLetter(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}
