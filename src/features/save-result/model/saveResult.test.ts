import { beforeEach, describe, expect, it } from 'vitest';
import { saveResult } from './saveResult';
import { historyStore, playsOf, resetHistory } from '@/entities/history';
import { progressStore, resetProgress } from '@/entities/progress';
import { sessionStore } from '@/entities/play-session';
import type { PlayResult } from '@/entities/score';

const result = (over: Partial<PlayResult> = {}): PlayResult => ({
  trackId: 'the-rift',
  score: 1200,
  accuracy: 0.91,
  rank: 'A',
  maxCombo: 30,
  totalNotes: 100,
  counts: { perfect: 80, great: 10, good: 5, miss: 5 },
  fullCombo: false,
  notesToS: 4,
  failed: false,
  hearts: 3,
  ...over,
});

describe('saveResult', () => {
  beforeEach(() => {
    resetHistory();
    resetProgress();
  });

  it('records every catalog run in the history, failed ones too, but only passes in progress', () => {
    saveResult(result(), 'catalog');
    saveResult(result({ failed: true, score: 100 }), 'catalog');
    expect(playsOf(historyStore.get(), 'the-rift')).toBe(2);
    expect(progressStore.get().plays).toBe(1);
    expect(progressStore.get().tracks['the-rift'].score).toBe(1200);
    expect(sessionStore.get().result?.failed).toBe(true);
  });

  it('skips custom songs entirely', () => {
    const meta = saveResult(result({ trackId: 'custom' }), 'custom');
    expect(meta.newRecord).toBe(false);
    expect(playsOf(historyStore.get(), 'custom')).toBe(0);
    expect(progressStore.get().plays).toBe(0);
  });
});
