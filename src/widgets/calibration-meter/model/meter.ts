/** The TapMeter shows ±150 ms across its 335 px track (screens-onboard notes). */
export const METER_RANGE_MS = 150;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Marker position on the meter, 0..100 % (50 = on the beat; early taps to the left, late to the right). */
export function meterPercent(ms: number): number {
  if (!Number.isFinite(ms)) return 50;
  return 50 + (clamp(ms, -METER_RANGE_MS, METER_RANGE_MS) / METER_RANGE_MS) * 50;
}

/** «+12», «−38», «0» — the sign always shown, a typographic minus. */
export function signedMs(ms: number): string {
  const n = Math.round(ms);
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${-n}`;
  return '0';
}

/** Which of the three explanations fits the measured offset. */
export type ShiftKind = 'late' | 'early' | 'none';

export function shiftKind(ms: number): ShiftKind {
  const n = Math.round(ms);
  if (n > 0) return 'late';
  if (n < 0) return 'early';
  return 'none';
}
