import { describe, expect, it, vi } from 'vitest';
import { isEligible, submitScore } from './submitScore';
import type { LeaderboardClient, LeaderboardSubmission } from '@/shared/api/leaderboard';
import type { PlayResult } from '@/entities/score';

const result = (over: Partial<PlayResult> = {}): PlayResult => ({
  trackId: 'the-rift',
  score: 500,
  accuracy: 0.9,
  rank: 'A',
  maxCombo: 12,
  totalNotes: 50,
  counts: { perfect: 40, great: 5, good: 3, miss: 2 },
  fullCombo: false,
  notesToS: 3,
  failed: false,
  stars: 3,
  crowns: 0,
  endless: false,
  level: 3,
  hearts: 4,
  timeline: { t: [], j: [], combo: [] },
  duration: 0,
  crystals: 0,
  ...over,
});

describe('submit-score', () => {
  it('only catalog runs that were not failed are eligible', () => {
    expect(isEligible(result(), 'catalog')).toBe(true);
    expect(isEligible(result({ failed: true }), 'catalog')).toBe(false);
    expect(isEligible(result(), 'custom')).toBe(false);
    expect(isEligible(null, 'catalog')).toBe(false);
  });

  it('posts once per run and shares the promise', async () => {
    const submit = vi.fn(async (_p: LeaderboardSubmission) => ({ enabled: true, ok: true, improved: true, position: 1, top: [] }));
    const client = { submit } as unknown as LeaderboardClient;
    const r = result();
    const a = submitScore(r, 'Neo', client);
    const b = submitScore(r, 'Neo', client);
    expect(a).toBe(b);
    expect((await a).position).toBe(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0]).toEqual({ track: 'the-rift', name: 'Neo', score: 500, accuracy: 0.9, rank: 'A', maxCombo: 12 });
    await submitScore(result(), 'Neo', client); // a different run → a new request
    expect(submit).toHaveBeenCalledTimes(2);
  });
});
