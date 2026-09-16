/** Difficulty tiers in the v3 palette, cool to hot: ★1–2 lime, ★3 cyan, ★4 gold, ★5 orange, ★6 magenta (charts never exceed ★6). */
const TIERS: ReadonlyArray<readonly [number, string]> = [
  [2, '#b6ff00'],
  [3, '#00f0ff'],
  [4, '#ffd700'],
  [5, '#ff8a00'],
  [Infinity, '#ff2bd6'],
];

/** Colour of a song difficulty (1–6): the flame says how hard before the number is read. */
export function difficultyColor(stars: number): string {
  for (const [max, color] of TIERS) if (stars <= max) return color;
  return TIERS[TIERS.length - 1][1];
}
