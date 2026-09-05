import { parseLocalCatalog, setLocalCatalog } from '../model/localCatalog';
import type { TrackMeta } from '../model/types';

let inflight: Promise<readonly TrackMeta[]> | null = null;

/**
 * Fetch `public/local/catalog.json` once per session and publish it to the local catalog store.
 * The file only exists on the author's machine (dev / preview); a 404, an SPA fallback page or a
 * network error all resolve to an empty list, silently.
 */
export function loadLocalCatalog(fetchImpl: typeof fetch | undefined = typeof fetch === 'function' ? fetch : undefined): Promise<readonly TrackMeta[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    let tracks: TrackMeta[] = [];
    try {
      if (fetchImpl) {
        const r = await fetchImpl(`${import.meta.env.BASE_URL}local/catalog.json`, { cache: 'no-store' });
        const type = r.headers.get('content-type') ?? '';
        if (r.ok && type.includes('json')) tracks = parseLocalCatalog(await r.json());
      }
    } catch {
      tracks = [];
    }
    setLocalCatalog(tracks);
    return tracks;
  })();
  return inflight;
}

/** Tests only: forget the memoised fetch. */
export function resetLocalCatalogLoader(): void {
  inflight = null;
}
