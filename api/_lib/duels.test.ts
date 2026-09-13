import { describe, expect, it } from 'vitest';
import { addReply, beatsHost, isDuelId, makeId, parseDuel, validateDuel, validateRun, type Duel, type DuelRun } from './duels';

const run = (name: string, score: number, accuracy = 0.9, at = '2026-01-01T00:00:00.000Z'): DuelRun => ({ name, score, accuracy, rank: 'A', at });
const duel: Duel = { id: 'abcd1234', track: 'hardstyler', host: run('Саша', 60_775), replies: [] };

describe('duels', () => {
  it('makes 8-char base-36 ids', () => {
    let i = 0;
    const id = makeId(() => ((i += 7) % 36) / 36);
    expect(id).toHaveLength(8);
    expect(isDuelId(id)).toBe(true);
    expect(isDuelId('ABCD1234')).toBe(false);
    expect(isDuelId('abc')).toBe(false);
  });

  it('validates a new duel: track and the host run', () => {
    const v = validateDuel({ track: 'hardstyler', name: ' Саша ', score: 60775.4, accuracy: 0.87654, rank: 'A' }, new Date('2026-09-14T00:00:00Z'));
    expect(v.ok).toBe(true);
    if (v.ok)
      expect(v.value).toEqual({ track: 'hardstyler', host: { name: 'Саша', score: 60775, accuracy: 0.8765, rank: 'A', at: '2026-09-14T00:00:00.000Z' } });
    expect(validateDuel({ track: 'Bad Track', name: 'x', score: 1, accuracy: 0.5, rank: 'A' }).ok).toBe(false);
    expect(validateRun({ name: '', score: 1, accuracy: 0.5, rank: 'A' }).ok).toBe(false);
    expect(validateRun({ name: 'x', score: -1, accuracy: 0.5, rank: 'A' }).ok).toBe(false);
    expect(validateRun({ name: 'x', score: 1, accuracy: 2, rank: 'A' }).ok).toBe(false);
    expect(validateRun({ name: 'x', score: 1, accuracy: 0.5, rank: 'Z' }).ok).toBe(false);
  });

  it('keeps the best reply per name, best first, and ignores the host answering themselves', () => {
    let d = addReply(duel, run('Петя', 50_000));
    d = addReply(d, run('петя', 61_000));
    d = addReply(d, run('Маша', 55_000));
    d = addReply(d, run('саша', 99_000));
    expect(d.replies.map((r) => [r.name, r.score])).toEqual([
      ['петя', 61_000],
      ['Маша', 55_000],
    ]);
    expect(beatsHost(d, run('Петя', 61_000))).toBe(true);
    expect(beatsHost(d, run('Маша', 55_000))).toBe(false);
    expect(beatsHost(d, run('Тоня', 60_775, 0.95))).toBe(true); // a tie on score goes to accuracy
  });

  it('parses stored duels and rejects junk', () => {
    expect(parseDuel(JSON.stringify(duel))).toEqual(duel);
    expect(parseDuel(JSON.stringify({ id: 'abcd1234', track: 'x' }))).toBeNull();
    expect(parseDuel('{')).toBeNull();
    expect(parseDuel(null)).toBeNull();
  });
});
