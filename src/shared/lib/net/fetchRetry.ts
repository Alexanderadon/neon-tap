/**
 * Network reads that survive a phone's connection: a mobile network stalls instead of failing (the
 * request just hangs), and a single dropped request used to leave a track unplayable. Every attempt
 * gets a stall timer — reset by each chunk that arrives, so a big file on a slow line is fine as long
 * as bytes keep coming — and failed attempts are retried with a short backoff. A 4xx is final.
 */
export interface FetchRetryOptions {
  /** Extra attempts after the first (default 2). */
  retries?: number;
  /** Abort an attempt when nothing has arrived for this long (default 12 s). */
  stallMs?: number;
  /** Bytes so far and the total (0 when the server does not say). */
  onProgress?: (loaded: number, total: number) => void;
  /** Cancels the whole read (no retry after it). */
  signal?: AbortSignal;
}

const STALL_MS = 12_000;
const BACKOFF_MS = 500;

/** A final HTTP error (404 and the like): retrying cannot help. */
export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`GET ${url}: ${status}`);
  }
}

/** The whole body as bytes. */
export async function fetchBytes(url: string, opts: FetchRetryOptions = {}): Promise<ArrayBuffer> {
  const retries = opts.retries ?? 2;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts.signal?.aborted) throw abortError();
    try {
      return await attemptOnce(url, opts);
    } catch (err) {
      if (opts.signal?.aborted || err instanceof HttpError) throw err;
      lastError = err;
      if (attempt < retries) await sleep(BACKOFF_MS * (attempt + 1), opts.signal);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`GET ${url} failed`);
}

/** The body parsed as JSON. */
export async function fetchJson<T>(url: string, opts: FetchRetryOptions = {}): Promise<T> {
  const bytes = await fetchBytes(url, opts);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function attemptOnce(url: string, opts: FetchRetryOptions): Promise<ArrayBuffer> {
  const ctrl = new AbortController();
  const stallMs = opts.stallMs ?? STALL_MS;
  let timer = setTimeout(() => ctrl.abort(), stallMs);
  const poke = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ctrl.abort(), stallMs);
  };
  const onOuterAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      if (res.status >= 400 && res.status < 500) throw new HttpError(url, res.status);
      throw new Error(`GET ${url}: ${res.status}`);
    }
    const total = Number(res.headers.get('content-length')) || 0;
    const reader = res.body?.getReader();
    if (!reader) {
      const all = await res.arrayBuffer();
      opts.onProgress?.(all.byteLength, all.byteLength);
      return all;
    }
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    opts.onProgress?.(0, total);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      poke();
      chunks.push(value);
      loaded += value.byteLength;
      opts.onProgress?.(loaded, total);
    }
    const out = new Uint8Array(loaded);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.byteLength;
    }
    return out.buffer;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function abortError(): Error {
  const err = new Error('aborted');
  err.name = 'AbortError';
  return err;
}
