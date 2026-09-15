/** The record the run beat: the best non-failed score among the earlier attempts (newest first, the current run at index 0). */
export function previousBest(attempts: readonly { score: number; failed: boolean }[]): number | null {
  let best: number | null = null;
  for (let i = 1; i < attempts.length; i++) {
    const a = attempts[i];
    if (a.failed) continue;
    if (best === null || a.score > best) best = a.score;
  }
  return best;
}
