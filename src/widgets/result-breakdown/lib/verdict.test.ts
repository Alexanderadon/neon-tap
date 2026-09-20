import { describe, expect, it } from 'vitest';
import { starsGained, verdictOf } from './verdict';

const run = (o: Partial<{ failed: boolean; stars: number; fullCombo: boolean; crowns: number; level: number }> = {}) => ({
  failed: false,
  stars: 2,
  fullCombo: false,
  ...o,
});
const meta = (starsBefore: number, starsAfter: number, newRecord = false) => ({ newRecord, starsBefore, starsAfter });

describe('verdictOf', () => {
  it('a failed run is ПРОВАЛ whatever else happened', () => {
    expect(verdictOf(run({ failed: true, stars: 0 }), meta(0, 2, true))).toEqual({ kind: 'failed', text: 'ПРОВАЛ' });
  });

  it('stars added to the record come first, with the Russian plural', () => {
    expect(verdictOf(run(), meta(0, 1))).toEqual({ kind: 'stars', text: '+1 звезда' });
    expect(verdictOf(run(), meta(0, 2))).toEqual({ kind: 'stars', text: '+2 звезды' });
    expect(verdictOf(run({ stars: 3 }), meta(0, 3))).toEqual({ kind: 'stars', text: '+3 звезды' });
    expect(starsGained(meta(3, 1))).toBe(0);
  });

  it('then a clean run, then a score record, then the level reached', () => {
    expect(verdictOf(run({ fullCombo: true }), meta(2, 2, true)).kind).toBe('no-miss');
    expect(verdictOf(run(), meta(2, 2, true))).toEqual({ kind: 'record', text: 'Новый рекорд' });
    expect(verdictOf(run({ stars: 3 }), meta(3, 3)).text).toBe('Все три звезды');
    expect(verdictOf(run({ stars: 2 }), meta(2, 2)).text).toBe('Две звезды');
    expect(verdictOf(run({ stars: 1 }), meta(1, 1)).text).toBe('Звезда есть');
    expect(verdictOf(run({ stars: 0 }), null).kind).toBe('none');
  });

  it('custom songs (no meta) fall back to the level reached', () => {
    expect(verdictOf(run({ stars: 3 }), null).text).toBe('Все три звезды');
  });

  it('endless runs: crowns added to the record, otherwise the loop reached', () => {
    const endless = run({ stars: 3, crowns: 2, level: 6 });
    expect(verdictOf(endless, { ...meta(3, 3), crownsBefore: 0, crownsAfter: 2 })).toEqual({ kind: 'crowns', text: '+2 короны' });
    expect(verdictOf(endless, { ...meta(3, 3), crownsBefore: 5, crownsAfter: 5 })).toEqual({ kind: 'loop', text: 'Круг 6' });
    expect(verdictOf(endless, null).text).toBe('+2 короны');
  });

  it('never exceeds 14 characters (28/900 in 335 px)', () => {
    const texts = [
      verdictOf(run({ failed: true }), null),
      verdictOf(run(), meta(0, 3)),
      verdictOf(run({ fullCombo: true }), meta(2, 2)),
      verdictOf(run(), meta(2, 2, true)),
      verdictOf(run({ stars: 3 }), null),
      verdictOf(run({ stars: 2 }), null),
      verdictOf(run({ stars: 1 }), null),
      verdictOf(run({ stars: 0 }), null),
    ].map((v) => v.text);
    for (const t of texts) expect(t.length).toBeLessThanOrEqual(14);
  });
});
