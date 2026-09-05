import { beforeEach, describe, expect, it } from 'vitest';
import { historyStore, recordAttempt, resetHistory } from './historyStore';
import { HISTORY_CAP, attemptsOf, playsOf, type Attempt } from './History';

const att = (score: number): Attempt => ({ at: '2026-01-01T00:00:00.000Z', score, accuracy: 0.9, rank: 'A', maxCombo: 5, failed: false });

describe('historyStore', () => {
  beforeEach(() => resetHistory());

  it('starts empty without localStorage', () => {
    expect(historyStore.get()).toEqual({ version: 1, tracks: {} });
  });

  it('records attempts and returns the attempt number', () => {
    expect(recordAttempt('t', att(1))).toBe(1);
    expect(recordAttempt('t', att(2))).toBe(2);
    expect(attemptsOf(historyStore.get(), 't')[0].score).toBe(2);
    for (let i = 0; i < HISTORY_CAP; i++) recordAttempt('t', att(i));
    expect(playsOf(historyStore.get(), 't')).toBe(HISTORY_CAP);
  });

  it('resets', () => {
    recordAttempt('t', att(1));
    resetHistory();
    expect(playsOf(historyStore.get(), 't')).toBe(0);
  });
});
