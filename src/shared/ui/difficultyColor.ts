/**
 * Difficulty in two tiers of the v3 palette: ★1–3 lime (calm), ★4–6 orange (hot). No gold — gold
 * means «earned» — and no magenta — magenta is a miss on the field (charts never exceed ★6).
 */
const TIERS: ReadonlyArray<readonly [number, string]> = [
  [3, '#b6ff00'],
  [Infinity, '#ff8a00'],
];

/** Colour of a song difficulty (1–6): the flame says how hard before the number is read. */
export function difficultyColor(stars: number): string {
  for (const [max, color] of TIERS) if (stars <= max) return color;
  return TIERS[TIERS.length - 1][1];
}
