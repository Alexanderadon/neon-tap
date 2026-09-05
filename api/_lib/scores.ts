/**
 * Pure helpers for the online leaderboard endpoint (`api/scores.ts`): validation, ranking and
 * best-per-name merging. No I/O, no Node APIs — unit-tested with vitest.
 */

export const RANKS = ['SS', 'S', 'A', 'B', 'C', 'D'] as const;
export type Rank = (typeof RANKS)[number];

export const TRACK_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const NAME_MAX = 16;
export const TOP_LIMIT = 20;
export const KEEP_LIMIT = 100;
export const MAX_SCORE = 100_000_000;
export const MAX_COMBO = 100_000;

/** One leaderboard row as returned to clients. */
export interface ScoreEntry {
  name: string;
  score: number;
  accuracy: number;
  rank: Rank;
  maxCombo: number;
  /** ISO timestamp. */
  at: string;
}

export interface Submission extends ScoreEntry {
  track: string;
}

export type Validation = { ok: true; value: Submission } | { ok: false; error: string };

/** Trim, collapse whitespace, drop control characters and angle brackets, cap the length. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\p{Cc}<>]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
}

/** Case-insensitive identity of a name — "best per name" ignores letter case. */
export function nameKey(name: string): string {
  return name.toLocaleLowerCase();
}

export function isTrackId(x: unknown): x is string {
  return typeof x === 'string' && TRACK_ID_RE.test(x);
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/** Validate a POST body. Returns a normalised submission or a short error code. */
export function validateSubmission(body: unknown, now: Date = new Date()): Validation {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'body' };
  const b = body as Record<string, unknown>;
  if (!isTrackId(b.track)) return { ok: false, error: 'track' };
  const name = sanitizeName(b.name);
  if (name.length < 1) return { ok: false, error: 'name' };
  if (!isFiniteNumber(b.score) || b.score < 0 || b.score > MAX_SCORE) return { ok: false, error: 'score' };
  if (!isFiniteNumber(b.accuracy) || b.accuracy < 0 || b.accuracy > 1) return { ok: false, error: 'accuracy' };
  if (typeof b.rank !== 'string' || !(RANKS as readonly string[]).includes(b.rank)) return { ok: false, error: 'rank' };
  const maxCombo = b.maxCombo === undefined ? 0 : b.maxCombo;
  if (!isFiniteNumber(maxCombo) || maxCombo < 0 || maxCombo > MAX_COMBO) return { ok: false, error: 'maxCombo' };
  return {
    ok: true,
    value: {
      track: b.track,
      name,
      score: Math.round(b.score),
      accuracy: Math.round(b.accuracy * 10_000) / 10_000,
      rank: b.rank as Rank,
      maxCombo: Math.round(maxCombo),
      at: now.toISOString(),
    },
  };
}

/** Compare two entries for the table: higher score, then higher accuracy, then earlier date. */
export function compareEntries(a: ScoreEntry, b: ScoreEntry): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy;
  return a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
}

/** Sort best-first (stable, does not mutate the input). */
export function rankEntries(entries: readonly ScoreEntry[]): ScoreEntry[] {
  return [...entries].sort(compareEntries);
}

/** Keep the best entry per (case-insensitive) name, ranked best-first. */
export function mergeBestPerName(entries: readonly ScoreEntry[]): ScoreEntry[] {
  const best = new Map<string, ScoreEntry>();
  for (const e of entries) {
    const key = nameKey(e.name);
    const prev = best.get(key);
    if (!prev || compareEntries(e, prev) < 0) best.set(key, e);
  }
  return rankEntries([...best.values()]);
}

/** 1-based position of a name in a ranked list, or null when absent. */
export function positionOf(ranked: readonly ScoreEntry[], name: string): number | null {
  const key = nameKey(name);
  const i = ranked.findIndex((e) => nameKey(e.name) === key);
  return i < 0 ? null : i + 1;
}

/**
 * Sorted-set score: the integer score plus the accuracy as a fraction, so Redis orders by score
 * and breaks ties by accuracy without a second key.
 */
export function zsetScore(e: Pick<ScoreEntry, 'score' | 'accuracy'>): number {
  return e.score + Math.min(0.9999, Math.max(0, e.accuracy)) * 0.9999;
}

/** Compact JSON member stored in the sorted set. */
export function encodeMember(e: ScoreEntry): string {
  return JSON.stringify({ n: e.name, s: e.score, a: e.accuracy, r: e.rank, c: e.maxCombo, t: e.at });
}

/** Parse a stored member; malformed rows yield null and are skipped. */
export function decodeMember(raw: unknown): ScoreEntry | null {
  if (typeof raw !== 'string') return null;
  try {
    const m = JSON.parse(raw) as Record<string, unknown>;
    const name = sanitizeName(m.n);
    if (!name || !isFiniteNumber(m.s) || !isFiniteNumber(m.a) || typeof m.t !== 'string') return null;
    const rank = typeof m.r === 'string' && (RANKS as readonly string[]).includes(m.r) ? (m.r as Rank) : 'D';
    return { name, score: m.s, accuracy: m.a, rank, maxCombo: isFiniteNumber(m.c) ? m.c : 0, at: m.t };
  } catch {
    return null;
  }
}

/** Decode a ZRANGE result (members only, best-first) into ranked entries. */
export function decodeMembers(raw: unknown): ScoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ScoreEntry[] = [];
  for (const m of raw) {
    const e = decodeMember(m);
    if (e) out.push(e);
  }
  return out;
}

export function redisKey(track: string): string {
  return `neon-tap:scores:${track}`;
}

/** Minimal fixed-window rate limiter keyed by IP. Best effort: state lives in the lambda instance. */
export function createRateLimiter(limit: number, windowMs: number, maxKeys = 5000) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function allow(key: string, now = Date.now()): boolean {
    let h = hits.get(key);
    if (!h || h.resetAt <= now) {
      if (hits.size >= maxKeys) hits.clear();
      h = { count: 0, resetAt: now + windowMs };
      hits.set(key, h);
    }
    h.count++;
    return h.count <= limit;
  };
}
