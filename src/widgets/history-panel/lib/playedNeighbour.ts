/**
 * The played track next to `current` in deck order (`dir` −1 = left, +1 = right), or null at the end
 * of the played ones. `current` itself need not be played — the arrows then lead to the nearest played
 * track on that side; an id outside `ids` has neighbours only to the right.
 */
export function playedNeighbour(ids: readonly string[], played: ReadonlySet<string>, current: string, dir: -1 | 1): string | null {
  const at = ids.indexOf(current);
  if (at < 0 && dir < 0) return null;
  for (let i = at + dir; i >= 0 && i < ids.length; i += dir) if (played.has(ids[i])) return ids[i];
  return null;
}
