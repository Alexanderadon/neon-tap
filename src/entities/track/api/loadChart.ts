import type { ChartFile } from '@/shared/types/chart';

const cache = new Map<string, Promise<ChartFile>>();

/** Fetch a built-in chart file (`public/charts/<id>.json`), memoised per session. */
export function loadChart(id: string): Promise<ChartFile> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}charts/${id}.json`).then(async (r) => {
      if (!r.ok) throw new Error(`chart ${id}: ${r.status}`);
      return (await r.json()) as ChartFile;
    });
    cache.set(id, p);
  }
  return p;
}
