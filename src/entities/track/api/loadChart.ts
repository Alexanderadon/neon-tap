import type { ChartFile } from '@/shared/types/chart';
import { isLocalTrack } from '../model/localCatalog';

const cache = new Map<string, Promise<ChartFile>>();

/** URL path (relative to the base) of a track's chart file: local tracks live under `local/`. */
export function chartPath(id: string): string {
  return isLocalTrack(id) ? `local/charts/${id}.json` : `charts/${id}.json`;
}

/** Fetch a built-in (`public/charts/<id>.json`) or local (`public/local/charts/<id>.json`) chart, memoised per session. */
export function loadChart(id: string): Promise<ChartFile> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}${chartPath(id)}`).then(async (r) => {
      if (!r.ok) throw new Error(`chart ${id}: ${r.status}`);
      return (await r.json()) as ChartFile;
    });
    cache.set(id, p);
  }
  return p;
}
