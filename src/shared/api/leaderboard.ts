import type { Rank } from '@/shared/types/result';

/**
 * Client for the optional online leaderboard (`api/scores.ts`). Every call resolves — network
 * errors, HTML 404s from the dev server and malformed answers all degrade to "not enabled" for
 * that call, and a definitive `enabled` flag from the server is cached for the session so the
 * probe happens once.
 */

export interface LeaderboardEntry {
  name: string;
  score: number;
  accuracy: number;
  rank: Rank;
  maxCombo: number;
  at: string;
}

export interface LeaderboardTop {
  enabled: boolean;
  top: LeaderboardEntry[];
  /** 1-based position of the requested name, when known. */
  position: number | null;
}

export interface LeaderboardSubmission {
  track: string;
  name: string;
  score: number;
  accuracy: number;
  rank: Rank;
  maxCombo: number;
}

export interface LeaderboardSubmitResult extends LeaderboardTop {
  ok: boolean;
  improved: boolean;
}

export interface LeaderboardClient {
  /** Whether the backend is configured; probed once per session (transport failures are retried). */
  isEnabled(): Promise<boolean>;
  fetchTop(track: string, name?: string): Promise<LeaderboardTop>;
  submit(payload: LeaderboardSubmission): Promise<LeaderboardSubmitResult>;
  /** Forget the cached probe (tests). */
  reset(): void;
}

interface Options {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
}

const DISABLED: LeaderboardTop = { enabled: false, top: [], position: null };
const RANKS: readonly string[] = ['SS', 'S', 'A', 'B', 'C', 'D'];
const PROBE_TRACK = 'probe';

function defaultEndpoint(): string {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  return `${base.endsWith('/') ? base : base + '/'}api/scores`;
}

function toEntry(x: unknown): LeaderboardEntry | null {
  if (!x || typeof x !== 'object') return null;
  const e = x as Record<string, unknown>;
  if (typeof e.name !== 'string' || typeof e.score !== 'number' || typeof e.accuracy !== 'number') return null;
  return {
    name: e.name,
    score: e.score,
    accuracy: e.accuracy,
    rank: typeof e.rank === 'string' && RANKS.includes(e.rank) ? (e.rank as Rank) : 'D',
    maxCombo: typeof e.maxCombo === 'number' ? e.maxCombo : 0,
    at: typeof e.at === 'string' ? e.at : '',
  };
}

function toTop(json: Record<string, unknown>): LeaderboardTop {
  const top = Array.isArray(json.top) ? json.top.map(toEntry).filter((e): e is LeaderboardEntry => e !== null) : [];
  return { enabled: json.enabled === true, top, position: typeof json.position === 'number' ? json.position : null };
}

export function createLeaderboardClient(opts: Options = {}): LeaderboardClient {
  const endpoint = opts.endpoint ?? defaultEndpoint();
  const timeoutMs = opts.timeoutMs ?? 6000;
  /** null = unknown yet. */
  let enabled: boolean | null = null;
  let probe: Promise<boolean> | null = null;

  /** Fetch + parse JSON; null on any failure. Never throws. */
  async function request(url: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
    const fetchImpl = opts.fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
    if (!fetchImpl) return null;
    try {
      const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined;
      const r = await fetchImpl(url, { ...init, signal });
      const type = r.headers?.get?.('content-type') ?? '';
      if (!type.includes('application/json')) return null;
      const json: unknown = await r.json();
      if (!json || typeof json !== 'object') return null;
      const obj = json as Record<string, unknown>;
      if (typeof obj.enabled === 'boolean') enabled = obj.enabled;
      return r.ok ? obj : null;
    } catch {
      return null;
    }
  }

  function isEnabled(): Promise<boolean> {
    if (enabled !== null) return Promise.resolve(enabled);
    if (!probe) {
      probe = request(`${endpoint}?track=${PROBE_TRACK}`)
        .then((json) => json?.enabled === true)
        .finally(() => {
          probe = null;
        });
    }
    return probe;
  }

  return {
    isEnabled,
    async fetchTop(track, name) {
      if (enabled === false) return DISABLED;
      const q = `?track=${encodeURIComponent(track)}${name ? `&name=${encodeURIComponent(name)}` : ''}`;
      const json = await request(endpoint + q);
      return json ? toTop(json) : DISABLED;
    },
    async submit(payload) {
      const off: LeaderboardSubmitResult = { ...DISABLED, ok: false, improved: false };
      if (!(await isEnabled())) return off;
      const json = await request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!json) return { ...off, enabled: enabled ?? false };
      return { ...toTop(json), ok: json.ok === true, improved: json.improved === true };
    },
    reset() {
      enabled = null;
      probe = null;
    },
  };
}

export const leaderboard: LeaderboardClient = createLeaderboardClient();
