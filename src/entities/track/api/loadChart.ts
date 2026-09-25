import type { ChartFile } from '@/shared/types/chart';
import { fetchJson } from '@/shared/lib/net';

const cache = new Map<string, Promise<ChartFile>>();

/**
 * Fetch a built-in chart file (`public/charts/<id>.json`), memoised per session. A dropped request is
 * retried; one that still fails is forgotten, so the next try goes to the network again (a cached
 * rejection used to leave the track unplayable until a reload).
 */
export function loadChart(id: string): Promise<ChartFile> {
  const hit = cache.get(id);
  if (hit) return hit;
  const p = fetchJson<ChartFile>(`${import.meta.env.BASE_URL}charts/${id}.json`);
  cache.set(id, p);
  p.catch(() => {
    if (cache.get(id) === p) cache.delete(id);
  });
  return p;
}
