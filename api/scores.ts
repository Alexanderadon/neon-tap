/**
 * Online leaderboard — Vercel serverless function (Node runtime, zero dependencies).
 *
 *   GET  /api/scores?track=<id>[&name=<nick>] → { enabled, top: ScoreEntry[≤20], position? }
 *   POST /api/scores  { track, name, score, accuracy, rank, maxCombo }
 *                                             → { enabled, ok, improved, position, top }
 *
 * Storage: Upstash Redis over its REST API — one sorted set per track
 * (`neon-tap:scores:<track>`, member = compact JSON row, score = points + accuracy fraction),
 * trimmed to the top 100, best row per (case-insensitive) name. Without
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN every call answers `{ enabled: false }`
 * so the client simply hides the section.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  KEEP_LIMIT,
  TOP_LIMIT,
  compareEntries,
  createRateLimiter,
  decodeMember,
  encodeMember,
  isTrackId,
  mergeBestPerName,
  nameKey,
  positionOf,
  redisKey,
  sanitizeName,
  validateSubmission,
  zsetScore,
  type ScoreEntry,
} from './_lib/scores.js';

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

/** Vercel's helper may have parsed the body already; otherwise read the stream (bounded). */
async function readJson(req: Req): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return JSON.parse(req.body);
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
    return req.body;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new Error('body too large');
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

interface Redis {
  /** Run one command; resolves to its result. */
  cmd(...args: (string | number)[]): Promise<unknown>;
  /** Run several commands in one round trip. */
  pipeline(cmds: (string | number)[][]): Promise<unknown[]>;
}

function redisFromEnv(): Redis | null {
  // Either the Upstash console's names or the ones the Vercel ⇄ Upstash marketplace integration injects.
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)?.replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const call = async (path: string, payload: unknown): Promise<unknown> => {
    const r = await fetch(url + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    });
    if (!r.ok) throw new Error(`redis ${r.status}`);
    return r.json();
  };
  return {
    async cmd(...args) {
      const out = (await call('', args)) as { result?: unknown; error?: string };
      if (out.error) throw new Error(out.error);
      return out.result;
    },
    async pipeline(cmds) {
      const out = (await call('/pipeline', cmds)) as Array<{ result?: unknown; error?: string }>;
      return out.map((o) => {
        if (o.error) throw new Error(o.error);
        return o.result;
      });
    },
  };
}

/** Stored rows of a track, best-first, paired with their raw members (needed for ZREM). */
async function loadRows(redis: Redis, track: string): Promise<Array<{ raw: string; entry: ScoreEntry }>> {
  const raw = await redis.cmd('ZREVRANGE', redisKey(track), 0, KEEP_LIMIT + 20);
  if (!Array.isArray(raw)) return [];
  const rows: Array<{ raw: string; entry: ScoreEntry }> = [];
  for (const m of raw) {
    const entry = decodeMember(m);
    if (entry && typeof m === 'string') rows.push({ raw: m, entry });
  }
  return rows;
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
      send(res, 200, { enabled: false, top: [] });
      return;
    }

    if (method === 'GET') {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const track = url.searchParams.get('track');
      if (!isTrackId(track)) {
        send(res, 400, { enabled: true, error: 'track' });
        return;
      }
      const name = sanitizeName(url.searchParams.get('name'));
      const ranked = mergeBestPerName((await loadRows(redis, track)).map((r) => r.entry));
      send(res, 200, {
        enabled: true,
        top: ranked.slice(0, TOP_LIMIT),
        position: name ? positionOf(ranked, name) : null,
      });
      return;
    }

    let body: unknown;
    try {
      body = await readJson(req);
    } catch {
      send(res, 400, { enabled: true, error: 'body' });
      return;
    }
    const v = validateSubmission(body);
    if (v.ok === false) {
      send(res, 400, { enabled: true, error: v.error });
      return;
    }
    const { track, ...entry } = v.value;
    const key = redisKey(track);
    const rows = await loadRows(redis, track);
    const mine = rows.filter((r) => nameKey(r.entry.name) === nameKey(entry.name));
    const currentBest = mine.length ? mergeBestPerName(mine.map((r) => r.entry))[0] : undefined;
    const improved = !currentBest || compareEntries(entry, currentBest) < 0;

    let ranked: ScoreEntry[];
    if (improved) {
      const cmds: (string | number)[][] = [];
      if (mine.length) cmds.push(['ZREM', key, ...mine.map((r) => r.raw)]);
      cmds.push(['ZADD', key, zsetScore(entry), encodeMember(entry)]);
      cmds.push(['ZREMRANGEBYRANK', key, 0, -(KEEP_LIMIT + 1)]);
      await redis.pipeline(cmds);
      ranked = mergeBestPerName([...rows.filter((r) => !mine.includes(r)).map((r) => r.entry), entry]).slice(0, KEEP_LIMIT);
    } else {
      ranked = mergeBestPerName(rows.map((r) => r.entry));
    }
    send(res, 200, {
      enabled: true,
      ok: true,
      improved,
      position: positionOf(ranked, entry.name),
      top: ranked.slice(0, TOP_LIMIT),
    });
  } catch (err) {
    console.error('[scores]', err);
    send(res, 502, { enabled: true, error: 'upstream' });
  }
}
