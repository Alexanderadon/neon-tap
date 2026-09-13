import type { Rank } from '@/shared/types/result';

export interface DuelRun {
  name: string;
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

export interface DuelRunInput {
  name: string;
  score: number;
  accuracy: number;
  rank: Rank;
}

export interface DuelsClient {
  /** Host a duel; null when the backend is off or the request failed. */
  create(track: string, run: DuelRunInput): Promise<Duel | null>;
  /** The duel behind a link; null when missing, expired or the backend is off. */
  fetch(id: string): Promise<Duel | null>;
  /** Answer a duel with a run; `beaten` says whether it beat the host. Null on failure. */
  reply(id: string, run: DuelRunInput): Promise<{ duel: Duel; beaten: boolean } | null>;
}

const RANKS: readonly string[] = ['SS', 'S', 'A', 'B', 'C', 'D'];

function toRun(x: unknown): DuelRun | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  if (typeof r.name !== 'string' || typeof r.score !== 'number') return null;
  return {
    name: r.name,
    score: r.score,
    accuracy: typeof r.accuracy === 'number' ? r.accuracy : 0,
    rank: typeof r.rank === 'string' && RANKS.includes(r.rank) ? (r.rank as Rank) : 'D',
    at: typeof r.at === 'string' ? r.at : '',
  };
}

/** Parse a duel from a response; null when it is not one. */
export function toDuel(x: unknown): Duel | null {
  if (!x || typeof x !== 'object') return null;
  const d = x as Record<string, unknown>;
  const host = toRun(d.host);
  if (typeof d.id !== 'string' || typeof d.track !== 'string' || !host) return null;
  const replies = Array.isArray(d.replies) ? d.replies.map(toRun).filter((r): r is DuelRun => r !== null) : [];
  return { id: d.id, track: d.track, host, replies };
}

/** The share link of a duel on this deployment. */
export function duelLink(id: string, origin = typeof location !== 'undefined' ? location.origin : ''): string {
  return `${origin}/?duel=${encodeURIComponent(id)}`;
}

/** The duel id in a page URL, or null. */
export function duelIdFromUrl(search = typeof location !== 'undefined' ? location.search : ''): string | null {
  const id = new URLSearchParams(search).get('duel');
  return id && /^[a-z0-9]{8}$/.test(id) ? id : null;
}

interface Options {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
}

function defaultEndpoint(): string {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  return `${base.endsWith('/') ? base : base + '/'}api/duels`;
}

export function createDuelsClient(opts: Options = {}): DuelsClient {
  const endpoint = opts.endpoint ?? defaultEndpoint();
  const timeoutMs = opts.timeoutMs ?? 6000;

  async function request(url: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
    const fetchImpl = opts.fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
    if (!fetchImpl) return null;
    try {
      const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined;
      const r = await fetchImpl(url, { ...init, signal });
      const json: unknown = await r.json();
      if (!r.ok || !json || typeof json !== 'object') return null;
      return json as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  const post = (url: string, body: unknown) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  return {
    async create(track, run) {
      const json = await post(endpoint, { track, ...run });
      return json && json.ok === true ? toDuel(json.duel) : null;
    },
    async fetch(id) {
      const json = await request(`${endpoint}?id=${encodeURIComponent(id)}`);
      return json ? toDuel(json.duel) : null;
    },
    async reply(id, run) {
      const json = await post(`${endpoint}?id=${encodeURIComponent(id)}`, run);
      const duel = json && json.ok === true ? toDuel(json.duel) : null;
      return duel ? { duel, beaten: json!.beaten === true } : null;
    },
  };
}

export const duels: DuelsClient = createDuelsClient();
