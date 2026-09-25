import { describe, expect, it } from 'vitest';
import {
  KEEP_LIMIT,
  NAME_MAX,
  TRACK_ID_RE,
  createRateLimiter,
  decodeMember,
  decodeMembers,
  encodeMember,
  isTrackId,
  mergeBestPerName,
  positionOf,
  rankEntries,
  redisKey,
  sanitizeName,
  validateSubmission,
  zsetScore,
  type ScoreEntry,
} from './scores';

const entry = (name: string, score: number, accuracy = 0.9, at = '2026-01-01T00:00:00.000Z'): ScoreEntry => ({
  name,
  score,
  accuracy,
  rank: 'A',
  maxCombo: 10,
  at,
});

const NOW = new Date('2026-05-05T12:00:00.000Z');
const valid = { track: 'the-rift', name: 'Neo', score: 1234.4, accuracy: 0.91234, rank: 'A', maxCombo: 42 };

describe('validateSubmission', () => {
  it('accepts a well-formed body and normalises it', () => {
    const v = validateSubmission(valid, NOW);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value).toEqual({ track: 'the-rift', name: 'Neo', score: 1234, accuracy: 0.9123, rank: 'A', maxCombo: 42, at: NOW.toISOString() });
  });

  it('rejects wrong types and out-of-range values', () => {
    const bad = (patch: Record<string, unknown>) => {
      const v = validateSubmission({ ...valid, ...patch }, NOW);
      return v.ok ? 'ok' : v.error;
    };
    expect(validateSubmission(null).ok).toBe(false);
    expect(validateSubmission([]).ok).toBe(false);
    expect(validateSubmission('x').ok).toBe(false);
    expect(bad({ track: 'The Rift' })).toBe('track');
    expect(bad({ track: '../etc' })).toBe('track');
    expect(bad({ track: 'a'.repeat(65) })).toBe('track');
    expect(bad({ name: '   ' })).toBe('name');
    expect(bad({ name: 42 })).toBe('name');
    expect(bad({ score: -1 })).toBe('score');
    expect(bad({ score: '100' })).toBe('score');
    expect(bad({ score: Infinity })).toBe('score');
    expect(bad({ accuracy: 1.01 })).toBe('accuracy');
    expect(bad({ accuracy: NaN })).toBe('accuracy');
    expect(bad({ rank: 'X' })).toBe('rank');
    expect(bad({ maxCombo: -5 })).toBe('maxCombo');
    expect(bad({ maxCombo: undefined })).toBe('ok');
  });

  it('sanitises names: whitespace, control chars, markup, length', () => {
    expect(sanitizeName('  Neon   Tap ')).toBe('Neon Tap');
    expect(sanitizeName('<script>x</script>')).toBe('scriptx/script');
    expect(sanitizeName('a\u0000b\u001fc')).toBe('abc');
    expect(sanitizeName('x'.repeat(50))).toHaveLength(NAME_MAX);
    expect(sanitizeName(undefined)).toBe('');
    expect(isTrackId('neon-hyperdrive')).toBe(true);
    expect(isTrackId('-bad')).toBe(false);
  });

  it("refuses the player's own songs: their `custom:` ids never pass the track pattern", () => {
    expect(TRACK_ID_RE.test('custom:0123456789abcdef0123')).toBe(false);
    expect(isTrackId('custom:0123456789abcdef0123')).toBe(false);
    expect(isTrackId('custom:My Song:4096')).toBe(false); // the id of the old session-only songs
    expect(validateSubmission({ ...valid, track: 'custom:0123456789abcdef0123' }, NOW)).toEqual({ ok: false, error: 'track' });
  });
});

describe('ranking', () => {
  it('orders by score, then accuracy, then earlier date', () => {
    const list = [entry('c', 100, 0.5, '2026-01-02'), entry('a', 100, 0.9), entry('b', 300), entry('d', 100, 0.5, '2026-01-01')];
    expect(rankEntries(list).map((e) => e.name)).toEqual(['b', 'a', 'd', 'c']);
    expect(list.map((e) => e.name)).toEqual(['c', 'a', 'b', 'd']); // input untouched
  });

  it('keeps the best per name, case-insensitively', () => {
    const merged = mergeBestPerName([entry('Neo', 100), entry('neo', 500), entry('Trinity', 400), entry('NEO', 500, 0.99)]);
    expect(merged.map((e) => [e.name, e.score])).toEqual([
      ['NEO', 500],
      ['Trinity', 400],
    ]);
    expect(positionOf(merged, 'trinity')).toBe(2);
    expect(positionOf(merged, 'morpheus')).toBeNull();
  });

  it('builds a sorted-set score that orders by score then accuracy', () => {
    expect(zsetScore({ score: 100, accuracy: 0.5 })).toBeGreaterThan(zsetScore({ score: 100, accuracy: 0.4 }));
    expect(zsetScore({ score: 101, accuracy: 0 })).toBeGreaterThan(zsetScore({ score: 100, accuracy: 1 }));
    expect(KEEP_LIMIT).toBeGreaterThanOrEqual(20);
    expect(redisKey('the-rift')).toBe('neon-tap:scores:the-rift');
  });

  it('round-trips members and skips garbage', () => {
    const e = entry('Neo', 100);
    expect(decodeMember(encodeMember(e))).toEqual(e);
    expect(decodeMember('{')).toBeNull();
    expect(decodeMember(JSON.stringify({ n: '', s: 1, a: 1, t: 'x' }))).toBeNull();
    expect(decodeMembers([encodeMember(e), 'oops', 5])).toEqual([e]);
    expect(decodeMembers('nope')).toEqual([]);
  });
});

describe('rate limiter', () => {
  it('allows `limit` hits per window and resets afterwards', () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow('ip', 0)).toBe(true);
    expect(allow('ip', 10)).toBe(true);
    expect(allow('ip', 20)).toBe(false);
    expect(allow('other', 20)).toBe(true);
    expect(allow('ip', 1001)).toBe(true);
  });
});
