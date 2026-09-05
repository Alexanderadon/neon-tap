import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetLocalTrackIds } from '@/shared/lib/local-tracks';
import { localCatalogStore, setLocalCatalog } from '../model/localCatalog';
import { chartPath } from './loadChart';
import { loadLocalCatalog, resetLocalCatalogLoader } from './loadLocalCatalog';

const response = (body: unknown, init: { ok?: boolean; status?: number; type?: string } = {}) =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers({ 'content-type': init.type ?? 'application/json' }),
    json: async () => body,
  }) as unknown as Response;

const fetchWith = (r: Response | Error) => vi.fn(async () => (r instanceof Error ? Promise.reject(r) : r)) as unknown as typeof fetch;

describe('loadLocalCatalog', () => {
  afterEach(() => {
    resetLocalCatalogLoader();
    setLocalCatalog([]);
    resetLocalTrackIds();
  });

  it('fetches /local/catalog.json once and publishes the parsed list', async () => {
    const f = fetchWith(response([{ id: 'x', title: 'X', stars: 4 }]));
    const tracks = await loadLocalCatalog(f);
    expect(f).toHaveBeenCalledTimes(1);
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('/local/catalog.json');
    expect(tracks.map((t) => t.id)).toEqual(['x']);
    expect(localCatalogStore.get()).toMatchObject({ loaded: true, tracks: [{ id: 'x', local: true, genre: 'local' }] });
    expect(chartPath('x')).toBe('local/charts/x.json');
    expect(chartPath('battle-theme')).toBe('charts/battle-theme.json');

    await loadLocalCatalog(f);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('is silent on 404, on an HTML fallback page and on a network error', async () => {
    expect(await loadLocalCatalog(fetchWith(response(null, { ok: false, status: 404 })))).toEqual([]);
    expect(localCatalogStore.get().loaded).toBe(true);
    resetLocalCatalogLoader();

    expect(await loadLocalCatalog(fetchWith(response('<!doctype html>', { type: 'text/html' })))).toEqual([]);
    resetLocalCatalogLoader();

    expect(await loadLocalCatalog(fetchWith(new Error('offline')))).toEqual([]);
    expect(localCatalogStore.get().tracks).toEqual([]);
  });

  it('works without fetch at all', async () => {
    expect(await loadLocalCatalog(undefined)).toEqual([]);
    expect(localCatalogStore.get().loaded).toBe(true);
  });
});
