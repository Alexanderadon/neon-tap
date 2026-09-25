import { describe, expect, it } from 'vitest';
import type { ResultMeta } from '@/entities/play-session';
import { economyNotes } from './notes';

const base: ResultMeta = { newRecord: false, starsBefore: 0, starsAfter: 0 };

describe('economy notes on the result screen', () => {
  it('tell the calendar mark and the full allowance, from the meta', () => {
    expect(economyNotes({ ...base, calendar: { day: 3, reward: 10 }, capped: 'day' })).toEqual([
      { key: 'calendar', text: 'Календарь: отметка 3 из 7 · +10 кристаллов' },
      { key: 'cap', text: 'Запас дня собран — дальше каждый пятый кристалл' },
    ]);
    expect(economyNotes({ ...base, calendar: { day: 1, reward: 5 } })[0].text).toBe('Календарь: отметка 1 из 7 · +5 кристаллов');
  });

  it('explain own-song limits calmly', () => {
    expect(economyNotes({ ...base, capped: 'custom' })).toEqual([{ key: 'cap', text: 'Свои песни на сегодня принесли все кристаллы' }]);
    expect(economyNotes({ ...base, capped: 'short' })).toEqual([{ key: 'cap', text: 'Песни короче минуты — без кристаллов' }]);
  });

  it('say nothing when there is nothing to tell', () => {
    expect(economyNotes(base)).toEqual([]);
    expect(economyNotes(null)).toEqual([]);
    expect(economyNotes(undefined)).toEqual([]);
  });
});
