/** Counter text for the wallet chips: thousands separated by a thin space, the way the score is written («102 400»). */
export function formatCount(n: number): string {
  const digits = String(Math.abs(Math.round(n)));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return n < 0 ? `−${grouped}` : grouped;
}

/** «+35» / «−12» badge text next to a chip. */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${formatCount(delta)}` : formatCount(delta);
}
