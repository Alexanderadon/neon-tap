import { describe, expect, it, vi } from 'vitest';
import { createLeaderboardClient } from './leaderboard';

type Call = { url: string; init?: RequestInit };

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => body,
  } as unknown as Response;
}

function mockFetch(answer: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return answer(call);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const payload = { track: 'the-rift', name: 'Neo', score: 100, accuracy: 0.9, rank: 'A' as const, maxCombo: 5 };

describe('leaderboard client', () => {
  it('probes once and short-circuits when the backend is disabled', async () => {
    const { fetchImpl, calls } = mockFetch(() => jsonResponse({ enabled: false, top: [] }));
    const client = createLeaderboardClient({ fetchImpl, endpoint: '/api/scores' });
    expect(await client.isEnabled()).toBe(false);
    expect(await client.isEnabled()).toBe(false);
    expect(await client.fetchTop('the-rift')).toEqual({ enabled: false, top: [], position: null });
    const sub = await client.submit(payload);
    expect(sub.ok).toBe(false);
    expect(sub.enabled).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/scores?track=probe');
  });

  it('never throws: network errors and HTML answers degrade to disabled without caching', async () => {
    let mode: 'throw' | 'html' | 'ok' = 'throw';
    const { fetchImpl, calls } = mockFetch(() => {
      if (mode === 'throw') throw new TypeError('offline');
      if (mode === 'html') return jsonResponse('<!doctype html>', 404, 'text/html');
      return jsonResponse({ enabled: true, top: [{ name: 'Neo', score: 1, accuracy: 1, rank: 'SS', maxCombo: 1, at: 'x' }] });
    });
    const client = createLeaderboardClient({ fetchImpl, endpoint: '/api/scores' });
    await expect(client.isEnabled()).resolves.toBe(false);
    mode = 'html';
    await expect(client.fetchTop('the-rift')).resolves.toEqual({ enabled: false, top: [], position: null });
    mode = 'ok';
    const top = await client.fetchTop('the-rift', 'Neo');
    expect(top.enabled).toBe(true);
    expect(top.top[0].name).toBe('Neo');
    expect(calls[2].url).toBe('/api/scores?track=the-rift&name=Neo');
    expect(await client.isEnabled()).toBe(true);
    expect(calls).toHaveLength(3);
  });

  it('submits JSON and returns position + top, dropping malformed rows', async () => {
    const { fetchImpl, calls } = mockFetch(({ init }) => {
      if (init?.method === 'POST') {
        return jsonResponse({
          enabled: true,
          ok: true,
          improved: true,
          position: 2,
          top: [{ name: 'Trinity', score: 200, accuracy: 0.95, rank: 'S', maxCombo: 9, at: 't' }, { bogus: 1 }, { name: 'Neo', score: 100, accuracy: 0.9, rank: 'ZZ' }],
        });
      }
      return jsonResponse({ enabled: true, top: [] });
    });
    const client = createLeaderboardClient({ fetchImpl, endpoint: '/api/scores' });
    const r = await client.submit(payload);
    expect(r.ok).toBe(true);
    expect(r.improved).toBe(true);
    expect(r.position).toBe(2);
    expect(r.top.map((e) => e.name)).toEqual(['Trinity', 'Neo']);
    expect(r.top[1].rank).toBe('D');
    expect(r.top[1].at).toBe('');
    const post = calls.find((c) => c.init?.method === 'POST')!;
    expect(JSON.parse(post.init!.body as string)).toEqual(payload);
  });

  it('reports a failed submission when the server rejects it', async () => {
    const { fetchImpl } = mockFetch(({ init }) => (init?.method === 'POST' ? jsonResponse({ enabled: true, error: 'name' }, 400) : jsonResponse({ enabled: true, top: [] })));
    const client = createLeaderboardClient({ fetchImpl, endpoint: '/api/scores' });
    const r = await client.submit(payload);
    expect(r.ok).toBe(false);
    expect(r.enabled).toBe(true);
  });
});
