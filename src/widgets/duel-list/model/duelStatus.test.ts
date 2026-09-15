import { describe, expect, it } from 'vitest';
import type { Duel, DuelRun } from '@/shared/api/duels';
import { duelStatus, duelSummary } from './duelStatus';

const run = (name: string, score: number, accuracy = 0.9): DuelRun => ({ name, score, accuracy, rank: 'A', at: '' });
const duel = (replies: DuelRun[]): Duel => ({ id: 'd1', track: 'metal', host: run('Саша', 102400), replies });

describe('duel status', () => {
  it('maps loading / missing / no replies / all behind / someone ahead', () => {
    expect(duelStatus(undefined)).toBe('loading');
    expect(duelStatus(null)).toBe('closed');
    expect(duelStatus(duel([]))).toBe('waiting');
    expect(duelStatus(duel([run('Макс', 97300), run('Ника', 58900)]))).toBe('ahead');
    expect(duelStatus(duel([run('Макс', 97300), run('Кира', 118200)]))).toBe('beaten');
    // A tie on score goes to accuracy.
    expect(duelStatus(duel([run('Кира', 102400, 0.99)]))).toBe('beaten');
    expect(duelStatus(duel([run('Кира', 102400, 0.5)]))).toBe('ahead');
  });

  it('counts calls and answers over the duels that loaded', () => {
    const loaded = { a: duel([run('x', 1), run('y', 2)]), b: null, c: duel([]) };
    expect(duelSummary(loaded, ['a', 'b', 'c', 'd'])).toEqual({ calls: 4, answers: 2 });
  });
});
