import { useEffect, useMemo, useState } from 'react';
import { duels, type Duel } from '@/shared/api/duels';
import { myDuels, type MyDuel } from '@/entities/duel';
import { duelSummary } from './duelStatus';

/** Hosted duels shown on the screen. */
const SHOW = 6;

export interface MyDuelsState {
  /** The duels this device hosted, newest first (ids + track). */
  mine: MyDuel[];
  /** What the backend answered per id: a duel, `null` when gone, missing while loading. */
  loaded: Readonly<Record<string, Duel | null>>;
  summary: { calls: number; answers: number };
}

/** The duels hosted from this device with their answers, fetched once per open. */
export function useMyDuels(): MyDuelsState {
  const mine = useMemo(() => myDuels().slice(0, SHOW), []);
  const [loaded, setLoaded] = useState<Record<string, Duel | null>>({});
  useEffect(() => {
    let alive = true;
    for (const d of mine) {
      duels.fetch(d.id).then((duel) => {
        if (alive) setLoaded((m) => ({ ...m, [d.id]: duel }));
      });
    }
    return () => {
      alive = false;
    };
  }, [mine]);
  const summary = useMemo(
    () =>
      duelSummary(
        loaded,
        mine.map((d) => d.id),
      ),
    [loaded, mine],
  );
  return { mine, loaded, summary };
}
