/**
 * Ids of the dev-only local tracks currently known to the app (filled by `entities/track` after
 * `public/local/catalog.json` is fetched). Lives in `shared` so `entities/progress` can leave these
 * ids out of the built-in catalog's star totals and goals without an upward import.
 * Empty in production — the catalog file is never deployed.
 */
const ids = new Set<string>();

export function registerLocalTrackIds(list: Iterable<string>): void {
  for (const id of list) ids.add(id);
}

export function isLocalTrackId(id: string): boolean {
  return ids.has(id);
}

export function localTrackIds(): string[] {
  return [...ids];
}

/** Tests only. */
export function resetLocalTrackIds(): void {
  ids.clear();
}
