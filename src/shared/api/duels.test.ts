import { describe, expect, it } from 'vitest';
import { createDuelsClient, duelIdFromUrl, duelLink, toDuel } from './duels';

const duel = {
  id: 'abcd1234',
  track: 'hardstyler',
  host: { name: 'Саша', score: 60775, accuracy: 0.9, rank: 'A', at: '2026-09-14T00:00:00.000Z' },
  replies: [],
};

function fakeFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const r = handler(String(url), init);
    return { ok: r.status < 400, status: r.status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => r.body } as Response;
  }) as typeof fetch;
}

describe('duels client', () => {
  it('builds and reads the share link', () => {
    expect(duelLink('abcd1234', 'https://neon-tap-virid.vercel.app')).toBe('https://neon-tap-virid.vercel.app/?duel=abcd1234');
    expect(duelIdFromUrl('?duel=abcd1234&x=1')).toBe('abcd1234');
    expect(duelIdFromUrl('?duel=ABCD')).toBeNull();
    expect(duelIdFromUrl('')).toBeNull();
  });

  it('creates, fetches and replies, and returns null on any failure', async () => {
    const calls: string[] = [];
    const client = createDuelsClient({
      endpoint: '/api/duels',
      fetchImpl: fakeFetch((url, init) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`);
        if (url === '/api/duels' && init?.method === 'POST') return { status: 200, body: { enabled: true, ok: true, id: duel.id, duel } };
        if (url === '/api/duels?id=abcd1234' && init?.method === 'POST')
          return {
            status: 200,
            body: { enabled: true, ok: true, duel: { ...duel, replies: [{ name: 'Петя', score: 70000, accuracy: 0.8, rank: 'B', at: '' }] }, beaten: true },
          };
        if (url === '/api/duels?id=abcd1234') return { status: 200, body: { enabled: true, duel } };
        return { status: 404, body: { enabled: true, error: 'notfound' } };
      }),
    });
    expect(await client.create('hardstyler', { name: 'Саша', score: 60775, accuracy: 0.9, rank: 'A' })).toEqual(duel);
    expect(await client.fetch('abcd1234')).toEqual(duel);
    expect(await client.fetch('zzzz9999')).toBeNull();
    const r = await client.reply('abcd1234', { name: 'Петя', score: 70000, accuracy: 0.8, rank: 'B' });
    expect(r?.beaten).toBe(true);
    expect(r?.duel.replies[0].name).toBe('Петя');
    expect(calls[0]).toBe('POST /api/duels');
  });

  it('parses only real duels', () => {
    expect(toDuel(duel)).toEqual(duel);
    expect(toDuel({ id: 'x' })).toBeNull();
    expect(toDuel(null)).toBeNull();
  });

  it('keeps a run avatar id of the right shape and drops the rest', () => {
    const withAvatar = toDuel({ ...duel, host: { ...duel.host, avatar: 'owl' } });
    expect(withAvatar?.host.avatar).toBe('owl');
    const bad = toDuel({ ...duel, host: { ...duel.host, avatar: 'Owl!' } });
    expect(bad?.host).not.toHaveProperty('avatar');
  });
});
