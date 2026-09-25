import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchBytes, fetchJson, HttpError } from './fetchRetry';

const ok = (text: string) => new Response(text, { status: 200, headers: { 'content-length': String(text.length) } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchBytes', () => {
  it('retries a dropped request and returns the body with progress', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(ok('abcd'));
    vi.stubGlobal('fetch', fetchMock);
    const seen: number[] = [];
    const bytes = await fetchBytes('/x', { onProgress: (n) => seen.push(n) });
    expect(new TextDecoder().decode(bytes)).toBe('abcd');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(seen.at(-1)).toBe(4);
  });

  it('does not retry a 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('no', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchBytes('/missing')).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retries and throws the last error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchBytes('/down', { retries: 1 })).rejects.toThrow('503');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('parses JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok('{"a":1}')));
    await expect(fetchJson<{ a: number }>('/j')).resolves.toEqual({ a: 1 });
  });
});
