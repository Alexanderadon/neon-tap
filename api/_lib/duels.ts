import { RANKS, isTrackId, nameKey, sanitizeName, type Rank } from './scores.js';

/** How long an unanswered duel lives, seconds (30 days). */
export const DUEL_TTL_SEC = 30 * 24 * 3600;
/** Replies kept per duel (best per name). */
export const REPLY_LIMIT = 20;
export const ID_LENGTH = 8;
export const MAX_SCORE = 100_000_000;

/** One run in a duel: who, how much. */
export interface DuelRun {
  name: string;
  /** The runner's chosen avatar id (lowercase letters), when they sent one. */
  avatar?: string;
  score: number;
  accuracy: number;
  rank: Rank;
  at: string;
}

export interface Duel {
  id: string;
  track: string;
  host: DuelRun;
  replies: DuelRun[];
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

const ID_RE = /^[a-z0-9]{8}$/;

export function isDuelId(x: unknown): x is string {
  return typeof x === 'string' && ID_RE.test(x);
}

/** A fresh id: 8 base-36 chars from `random` (0..1). */
export function makeId(random: () => number = Math.random): string {
  let s = '';
  while (s.length < ID_LENGTH) s += Math.floor(random() * 36).toString(36);
  return s.slice(0, ID_LENGTH);
}

export function redisDuelKey(id: string): string {
  return `neon-tap:duel:${id}`;
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/** Validate a run (host or reply) from a request body. */
export function validateRun(body: unknown, now: Date = new Date()): Validation<DuelRun> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body' };
  const b = body as Record<string, unknown>;
  const name = sanitizeName(b.name);
  if (name.length < 1) return { ok: false, error: 'name' };
  if (!isFiniteNumber(b.score) || b.score < 0 || b.score > MAX_SCORE) return { ok: false, error: 'score' };
  if (!isFiniteNumber(b.accuracy) || b.accuracy < 0 || b.accuracy > 1) return { ok: false, error: 'accuracy' };
  if (typeof b.rank !== 'string' || !(RANKS as readonly string[]).includes(b.rank)) return { ok: false, error: 'rank' };
  const avatar = sanitizeAvatar(b.avatar);
  return {
    ok: true,
    value: {
      name,
      ...(avatar ? { avatar } : {}),
      score: Math.round(b.score),
      accuracy: Math.round(b.accuracy * 10_000) / 10_000,
      rank: b.rank as Rank,
      at: now.toISOString(),
    },
  };
}

const AVATAR_SLUG = /^[a-z]{1,16}$/;

/** An avatar id as sent by the client: lowercase letters only, else dropped (the client maps unknown ids to the letter avatar). */
export function sanitizeAvatar(x: unknown): string {
  return typeof x === 'string' && AVATAR_SLUG.test(x) ? x : '';
}

/** Validate a new duel: a track plus the host's run. */
export function validateDuel(body: unknown, now: Date = new Date()): Validation<{ track: string; host: DuelRun }> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body' };
  const b = body as Record<string, unknown>;
  if (!isTrackId(b.track)) return { ok: false, error: 'track' };
  const run = validateRun(b, now);
  if (run.ok === false) return run;
  return { ok: true, value: { track: b.track, host: run.value } };
}

/** Higher score wins; ties go to accuracy, then to the earlier run. */
export function compareRuns(a: DuelRun, b: DuelRun): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy;
  return a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
}

/** Add a reply: the best run per name is kept, sorted best-first, at most REPLY_LIMIT. The host answering their own duel is ignored. */
export function addReply(duel: Duel, run: DuelRun): Duel {
  if (nameKey(run.name) === nameKey(duel.host.name)) return duel;
  const best = new Map<string, DuelRun>();
  for (const r of [...duel.replies, run]) {
    const key = nameKey(r.name);
    const prev = best.get(key);
    if (!prev || compareRuns(r, prev) < 0) best.set(key, r);
  }
  return { ...duel, replies: [...best.values()].sort(compareRuns).slice(0, REPLY_LIMIT) };
}

/** Did this run beat the host? */
export function beatsHost(duel: Duel, run: DuelRun): boolean {
  return compareRuns(run, duel.host) < 0;
}

/** Parse a stored duel; null when the JSON is not a duel. */
export function parseDuel(raw: unknown): Duel | null {
  if (typeof raw !== 'string') return null;
  try {
    const d = JSON.parse(raw) as Duel;
    if (!d || !isDuelId(d.id) || !isTrackId(d.track) || !d.host || typeof d.host.name !== 'string') return null;
    return { id: d.id, track: d.track, host: d.host, replies: Array.isArray(d.replies) ? d.replies : [] };
  } catch {
    return null;
  }
}
