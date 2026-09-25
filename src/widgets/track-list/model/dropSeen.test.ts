import { describe, expect, it } from 'vitest';
import { dropState, releaseMs, type DropState, type TrackMeta } from '@/entities/track';
import { DROP_SEEN_KEY, markDropSeen, thisWeekDrop, unseenDrop } from './dropSeen';

const DAY = 86_400_000;
const meta = (id: string, release: string) => ({ id, release, drop: true }) as TrackMeta;
const catalog = [{ id: 'road' } as TrackMeta, meta('d0', '2026-10-05'), meta('d1', '2026-10-12')];

function locks(nowMs: number): { drops: Map<string, DropState> } {
  return { drops: new Map(catalog.filter((t) => t.drop).map((t) => [t.id, dropState(t, { nowMs, owned: false, pass: false, unlockAll: false })])) };
}

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe('the new week toast', () => {
  it('finds this week’s drop — released less than seven days ago', () => {
    expect(thisWeekDrop(catalog, locks(releaseMs('2026-10-05') - 1))).toBeNull();
    expect(thisWeekDrop(catalog, locks(releaseMs('2026-10-05')))?.id).toBe('d0');
    expect(thisWeekDrop(catalog, locks(releaseMs('2026-10-12') + DAY))?.id).toBe('d1');
    expect(thisWeekDrop(catalog, locks(releaseMs('2026-10-19')))).toBeNull();
  });

  it('shows once per drop and device', () => {
    const state = locks(releaseMs('2026-10-12') + DAY);
    const store = memory();
    expect(unseenDrop(catalog, state, store)?.id).toBe('d1');
    markDropSeen(store, 'd1');
    expect(store.data.get(DROP_SEEN_KEY)).toBe('d1');
    expect(unseenDrop(catalog, state, store)).toBeNull();
    // Next week's drop is news again.
    const withD2 = [...catalog, meta('d2', '2026-10-19')];
    const next = {
      drops: new Map(
        withD2.filter((t) => t.drop).map((t) => [t.id, dropState(t, { nowMs: releaseMs('2026-10-19'), owned: false, pass: false, unlockAll: false })]),
      ),
    };
    expect(unseenDrop(withD2, next, store)?.id).toBe('d2');
  });

  it('stays quiet without storage or when it throws', () => {
    const state = locks(releaseMs('2026-10-05'));
    expect(unseenDrop(catalog, state, null)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(unseenDrop(catalog, state, broken)).toBeNull();
    const full = {
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => markDropSeen(full, 'd0')).not.toThrow();
  });
});
