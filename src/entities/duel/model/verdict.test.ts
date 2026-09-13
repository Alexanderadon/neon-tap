import { describe, expect, it } from 'vitest';
import { duelVerdict } from './verdict';
import { myDuels, rememberDuel, MY_DUELS_KEY } from './myDuels';

const host = { name: 'Саша', score: 60_775, accuracy: 0.9, rank: 'A' as const, at: '' };

describe('duelVerdict', () => {
  it('needs a higher score, or the same score with better accuracy', () => {
    expect(duelVerdict(host, { score: 60_776, accuracy: 0.1 })).toBe('beaten');
    expect(duelVerdict(host, { score: 60_775, accuracy: 0.95 })).toBe('beaten');
    expect(duelVerdict(host, { score: 60_775, accuracy: 0.9 })).toBe('lost');
    expect(duelVerdict(host, { score: 60_000, accuracy: 1 })).toBe('lost');
  });
});

describe('myDuels', () => {
  it('remembers hosted duels newest first, without duplicates, at most twenty', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } as Storage;
    for (let i = 0; i < 25; i++)
      rememberDuel({ id: `id${i.toString().padStart(6, '0')}`, track: 'hardstyler', at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` }, storage);
    rememberDuel({ id: 'id000024', track: 'hardstyler', at: '2026-02-01' }, storage);
    const list = myDuels(storage);
    expect(list).toHaveLength(20);
    expect(list[0].id).toBe('id000024');
    expect(list.filter((d) => d.id === 'id000024')).toHaveLength(1);
    expect(store.has(MY_DUELS_KEY)).toBe(true);
    expect(myDuels({ getItem: () => '{bad', setItem: () => undefined } as unknown as Storage)).toEqual([]);
  });
});
