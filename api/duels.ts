/**
 * Duels: "I scored X on this track — beat me". A duel is one host run behind a short id; friends
 * open the link, play the same track and reply with their run. Kept 30 days.
 *
 *   POST /api/duels            { track, name, score, accuracy, rank } → { enabled, ok, id }
 *   GET  /api/duels?id=<id>    → { enabled, duel }
 *   POST /api/duels?id=<id>    { name, score, accuracy, rank }        → { enabled, ok, duel, beaten }
 *
 * Same storage and limits as the scores: Upstash Redis REST; without it every call answers
 * `{ enabled: false }`. Rate-limited per IP.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRateLimiter } from './_lib/scores.js';
import { DUEL_TTL_SEC, addReply, beatsHost, isDuelId, makeId, parseDuel, redisDuelKey, validateDuel, validateRun, type Duel } from './_lib/duels.js';

type Req = IncomingMessage & { body?: unknown };

const allowRead = createRateLimiter(60, 60_000);
const allowWrite = createRateLimiter(20, 60_000);
const REDIS_TIMEOUT_MS = 4000;
const MAX_BODY_BYTES = 4096;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  const real = req.headers['x-real-ip'];
  return first || (Array.isArray(real) ? real[0] : real) || req.socket?.remoteAddress || 'unknown';
}

async function readJson(req: Req): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return JSON.parse(req.body);
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
    return req.body;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new Error('body too large');
    chunks.push(buf);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

interface Redis {
  cmd(...args: (string | number)[]): Promise<unknown>;
}

function redisFromEnv(): Redis | null {
  // Either the Upstash console's names or the ones the Vercel ⇄ Upstash marketplace integration injects.
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)?.replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return {
    async cmd(...args) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
      });
      if (!r.ok) throw new Error(`redis ${r.status}`);
      const out = (await r.json()) as { result?: unknown; error?: string };
      if (out.error) throw new Error(out.error);
      return out.result;
    },
  };
}

async function loadDuel(redis: Redis, id: string): Promise<Duel | null> {
  return parseDuel(await redis.cmd('GET', redisDuelKey(id)));
}

async function saveDuel(redis: Redis, duel: Duel): Promise<void> {
  await redis.cmd('SET', redisDuelKey(duel.id), JSON.stringify(duel), 'EX', DUEL_TTL_SEC);
}

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  try {
    const method = (req.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      send(res, 405, { error: 'method' });
      return;
    }
    const ip = clientIp(req);
    if (!(method === 'GET' ? allowRead(ip) : allowWrite(ip))) {
      send(res, 429, { error: 'rate' });
      return;
    }
    const redis = redisFromEnv();
    if (!redis) {
      send(res, 200, { enabled: false });
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    const id = url.searchParams.get('id');

    if (method === 'GET') {
      if (!isDuelId(id)) {
        send(res, 400, { enabled: true, error: 'id' });
        return;
      }
      const duel = await loadDuel(redis, id);
      if (!duel) {
        send(res, 404, { enabled: true, error: 'notfound' });
        return;
      }
      send(res, 200, { enabled: true, duel });
      return;
    }

    let body: unknown;
    try {
      body = await readJson(req);
    } catch {
      send(res, 400, { enabled: true, error: 'body' });
      return;
    }

    if (id === null) {
      // A new duel.
      const v = validateDuel(body);
      if (v.ok === false) {
        send(res, 400, { enabled: true, error: v.error });
        return;
      }
      let duel: Duel | null = null;
      for (let attempt = 0; attempt < 5 && !duel; attempt++) {
        const candidate: Duel = { id: makeId(), track: v.value.track, host: v.value.host, replies: [] };
        const set = await redis.cmd('SET', redisDuelKey(candidate.id), JSON.stringify(candidate), 'EX', DUEL_TTL_SEC, 'NX');
        if (set === 'OK') duel = candidate;
      }
      if (!duel) {
        send(res, 502, { enabled: true, error: 'id' });
        return;
      }
      send(res, 200, { enabled: true, ok: true, id: duel.id, duel });
      return;
    }

    // A reply.
    if (!isDuelId(id)) {
      send(res, 400, { enabled: true, error: 'id' });
      return;
    }
    const v = validateRun(body);
    if (v.ok === false) {
      send(res, 400, { enabled: true, error: v.error });
      return;
    }
    const duel = await loadDuel(redis, id);
    if (!duel) {
      send(res, 404, { enabled: true, error: 'notfound' });
      return;
    }
    const updated = addReply(duel, v.value);
    if (updated !== duel) await saveDuel(redis, updated);
    send(res, 200, { enabled: true, ok: true, duel: updated, beaten: beatsHost(duel, v.value) });
  } catch (err) {
    console.error('[duels]', err);
    send(res, 502, { enabled: true, error: 'upstream' });
  }
}
