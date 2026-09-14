/** Difficulty tiers, cool to hot: the colour says how hard before the number is read. */
const TIERS: ReadonlyArray<readonly [number, string]> = [
  [2, '#b6ff00'],
  [4, '#00f0ff'],
  [6, '#ffe14d'],
  [8, '#ff8a00'],
  [Infinity, '#ff2b6d'],
];

/** Colour of a song difficulty (1–10). */
export function difficultyColor(stars: number): string {
  for (const [max, color] of TIERS) if (stars <= max) return color;
  return TIERS[TIERS.length - 1][1];
}
