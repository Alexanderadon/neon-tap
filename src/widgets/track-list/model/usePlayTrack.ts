import { useCallback, useState } from 'react';
import { navigate } from '@/shared/lib/router';
import { loadChart } from '@/entities/track';
import { startSession } from '@/entities/play-session';
import { progressStore, starsForTrack } from '@/entities/progress';
import { endlessStore } from './endless';
import { clearActiveDuel } from '@/entities/duel';

/** Loads a catalog chart, opens a session and jumps to the game; `busy` while the chart loads. */
export function usePlayTrack(): { busy: string | null; play: (id: string) => Promise<void> } {
  const [busy, setBusy] = useState<string | null>(null);
  const play = useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy(id);
      try {
        const chart = await loadChart(id);
        clearActiveDuel(); // a track picked from the deck is a plain run, not an answer to a duel
        // The ∞ switch is one for the deck, but a loop past the third star is offered only on a track that already has all three.
        startSession(chart, 'catalog', null, endlessStore.get().on && starsForTrack(progressStore.get().tracks[id]) >= 3);
        navigate('game');
      } finally {
        setBusy(null);
      }
    },
    [busy],
  );
  return { busy, play };
}
