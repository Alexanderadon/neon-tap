import { describe, expect, it } from 'vitest';
import {
  HISTORY_CAP,
  addAttempt,
  attemptsOf,
  bestOf,
  emptyHistory,
  parseHistory,
  playsOf,
  trendDirection,
  trendOf,
  type Attempt,
} from './History';

const att = (accuracy: number, score = Math.round(accuracy * 1000), failed = false, at = '2026-01-01T00:00:00.000Z'): Attempt => ({
  at,
  score,
  accuracy,
  rank: accuracy >= 0.95 ? 'S' : accuracy >= 0.9 ? 'A' : 'B',
  maxCombo: 10,
  failed,
});

describe('history model', () => {
  it('parses stored blobs defensively', () => {
    expect(parseHistory(null)).toEqual(emptyHistory());
    expect(parseHistory('x')).toEqual(emptyHistory());
    expect(parseHistory({ version: 2, tracks: {} })).toEqual(emptyHistory());
    const good = att(0.9);
    const parsed = parseHistory({ version: 1, tracks: { t: [good, { bogus: true }, { ...good, rank: 'Z' }], u: 'nope' } });
    expect(parsed.tracks.t).toEqual([good]);
    expect(parsed.tracks.u).toBeUndefined();
  });

  it('keeps attempts newest first and caps them per track', () => {
    let data = emptyHistory();
    for (let i = 0; i < HISTORY_CAP + 7; i++) data = addAttempt(data, 't', att(0.5, i));
    const list = attemptsOf(data, 't');
    expect(list).toHaveLength(HISTORY_CAP);
    expect(list[0].score).toBe(HISTORY_CAP + 6);
    expect(list[list.length - 1].score).toBe(7);
    expect(playsOf(data, 't')).toBe(HISTORY_CAP);
    expect(playsOf(data, 'other')).toBe(0);
    // a parsed over-long list is trimmed too
    const raw = { version: 1, tracks: { t: Array.from({ length: 60 }, (_, i) => att(0.5, i)) } };
    expect(parseHistory(raw).tracks.t).toHaveLength(HISTORY_CAP);
  });

  it('does not touch other tracks when adding', () => {
    let data = addAttempt(emptyHistory(), 'a', att(0.8));
    data = addAttempt(data, 'b', att(0.7));
    expect(playsOf(data, 'a')).toBe(1);
    expect(playsOf(data, 'b')).toBe(1);
  });

  it('picks the best non-failed attempt by score, then accuracy, then the earlier one', () => {
    let data = emptyHistory();
    data = addAttempt(data, 't', att(0.8, 800, false, '2026-01-01T00:00:00Z'));
    data = addAttempt(data, 't', att(0.99, 5000, true, '2026-01-02T00:00:00Z')); // failed → ignored
    data = addAttempt(data, 't', att(0.85, 900, false, '2026-01-03T00:00:00Z'));
    data = addAttempt(data, 't', att(0.9, 900, false, '2026-01-04T00:00:00Z'));
    data = addAttempt(data, 't', att(0.9, 900, false, '2026-01-05T00:00:00Z'));
    const best = bestOf(data, 't');
    expect(best?.score).toBe(900);
    expect(best?.accuracy).toBe(0.9);
    expect(best?.at).toBe('2026-01-04T00:00:00Z');
    expect(bestOf(data, 'none')).toBeUndefined();
    const onlyFailed = addAttempt(emptyHistory(), 'f', att(0.5, 100, true));
    expect(bestOf(onlyFailed, 'f')).toBeUndefined();
  });

  it('computes the accuracy trend over the last five attempts', () => {
    let data = emptyHistory();
    expect(trendOf(data, 't')).toBe(0);
    data = addAttempt(data, 't', att(0.5));
    expect(trendOf(data, 't')).toBe(0);
    // oldest → newest: 0.5, 0.6, 0.7, 0.8, 0.9, 0.95
    for (const a of [0.6, 0.7, 0.8, 0.9, 0.95]) data = addAttempt(data, 't', att(a));
    // window = newest five (0.95 … 0.6) → 0.95 − 0.6
    expect(trendOf(data, 't')).toBeCloseTo(0.35);
    data = addAttempt(data, 't', att(0.4));
    expect(trendOf(data, 't')).toBeCloseTo(0.4 - 0.7);
  });

  it('maps a delta to an arrow direction with a dead zone', () => {
    expect(trendDirection(0.02)).toBe('up');
    expect(trendDirection(-0.02)).toBe('down');
    expect(trendDirection(0.001)).toBe('flat');
    expect(trendDirection(0)).toBe('flat');
  });
});
