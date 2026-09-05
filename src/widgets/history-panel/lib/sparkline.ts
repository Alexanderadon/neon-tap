export interface SparkPoint {
  x: number;
  y: number;
}

/**
 * Map a series (oldest → newest) onto an SVG box. `values` are 0..1 (accuracy); the vertical
 * range zooms to the data with a small margin so a 90→95 % climb is visible, but never below
 * a 10-point span. Single values sit in the middle.
 */
export function sparklinePoints(values: readonly number[], width: number, height: number, pad = 3): SparkPoint[] {
  const n = values.length;
  if (n === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  let span = max - min;
  if (span < 0.1) {
    const mid = (max + min) / 2;
    min = Math.max(0, mid - 0.05);
    max = Math.min(1, min + 0.1);
    min = max - 0.1;
    span = 0.1;
  }
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return values.map((v, i) => ({
    x: n === 1 ? width / 2 : pad + (innerW * i) / (n - 1),
    y: pad + innerH * (1 - (v - min) / span),
  }));
}

/** `x,y x,y …` for an SVG polyline, rounded to 0.1 px. */
export function toPolyline(points: readonly SparkPoint[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}
