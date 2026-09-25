import { describe, expect, it } from 'vitest';
import { canChallenge, challengeText, createChallenge, replyToDuel } from './challenge';
import type { Duel, DuelsClient } from '@/shared/api/duels';
import type { PlayResult } from '@/entities/score';

const result = {
  trackId: 'hardstyler',
  score: 60_775,
  accuracy: 0.9,
  rank: 'A',
  maxCombo: 100,
  totalNotes: 300,
  failed: false,
  stars: 3,
  level: 3,
} as unknown as PlayResult;
const duel: Duel = {
  id: 'abcd1234',
  track: 'hardstyler',
  host: { name: 'Саша', score: 60_775, accuracy: 0.9, rank: 'A', at: '2026-09-14T00:00:00.000Z' },
  replies: [],
};

describe('challenge', () => {
  it('only a finished, scored run can challenge', () => {
    expect(canChallenge(result)).toBe(true);
    expect(canChallenge({ ...result, failed: true })).toBe(false);
    expect(canChallenge({ ...result, score: 0 })).toBe(false);
    expect(canChallenge(null)).toBe(false);
  });

  it('a run on the player own song cannot challenge', () => {
    expect(canChallenge({ ...result, trackId: 'custom:0123456789abcdef0123' })).toBe(false);
  });

  it('creates a duel once per run and phrases the invitation', async () => {
    let calls = 0;
    const client: DuelsClient = {
      create: async () => {
        calls++;
        return duel;
      },
      fetch: async () => null,
      reply: async () => null,
    };
    const a = createChallenge(result, { name: 'Саша' }, client);
    const b = createChallenge(result, { name: 'Саша' }, client);
    expect(await a).toEqual(duel);
    expect(await b).toEqual(duel);
    expect(calls).toBe(1);
    expect(challengeText(duel, 'Hardstyler')).toContain('Саша: 60');
    expect(challengeText(duel, 'Hardstyler')).toContain('?duel=abcd1234');
  });

  it('replies once per run', async () => {
    let calls = 0;
    const client: DuelsClient = {
      create: async () => null,
      fetch: async () => null,
      reply: async () => {
        calls++;
        return { duel, beaten: true };
      },
    };
    const mine = { ...result, score: 70_000 } as PlayResult;
    await replyToDuel(duel, mine, { name: 'Петя' }, client);
    const r = await replyToDuel(duel, mine, { name: 'Петя', avatar: 'owl' }, client);
    expect(r?.beaten).toBe(true);
    expect(calls).toBe(1);
  });

  it('sends the chosen avatar with the run and nothing when there is none', async () => {
    const sent: unknown[] = [];
    const client: DuelsClient = {
      create: async (_track, run) => {
        sent.push(run);
        return duel;
      },
      fetch: async () => null,
      reply: async (_id, run) => {
        sent.push(run);
        return { duel, beaten: false };
      },
    };
    const first = { ...result } as PlayResult;
    const second = { ...result, score: 1 } as PlayResult;
    await createChallenge(first, { name: 'Саша', avatar: 'fox' }, client);
    await replyToDuel(duel, second, { name: 'Петя', avatar: '' }, client);
    expect(sent[0]).toMatchObject({ name: 'Саша', avatar: 'fox', score: 60_775 });
    expect(sent[1]).toEqual({ name: 'Петя', score: 1, accuracy: 0.9, rank: 'A' });
  });
});
