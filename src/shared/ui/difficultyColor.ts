/** Difficulty tiers in the v3 palette, cool to hot: ≤ 2 lime, ≤ 4 cyan, 5–6 gold, 7–8 orange, 9–10 magenta. */
const TIERS: ReadonlyArray<readonly [number, string]> = [
  [2, '#b6ff00'],
  [4, '#00f0ff'],
  [6, '#ffd700'],
  [8, '#ff8a00'],
  [Infinity, '#ff2bd6'],
];

/** Colour of a song difficulty (1–10): the flame says how hard before the number is read. */
export function difficultyColor(stars: number): string {
  for (const [max, color] of TIERS) if (stars <= max) return color;
  return TIERS[TIERS.length - 1][1];
}
