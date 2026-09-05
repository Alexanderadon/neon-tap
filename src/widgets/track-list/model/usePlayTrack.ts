import { useCallback, useState } from 'react';
import { navigate } from '@/shared/lib/router';
import { loadChart } from '@/entities/track';
import { startSession } from '@/entities/play-session';

/** Loads a catalog chart, opens a session and jumps to the game; `busy` while the chart loads. */
export function usePlayTrack(): { busy: string | null; play: (id: string) => Promise<void> } {
  const [busy, setBusy] = useState<string | null>(null);
  const play = useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy(id);
      try {
        const chart = await loadChart(id);
        startSession(chart, 'catalog');
        navigate('game');
      } finally {
        setBusy(null);
      }
    },
    [busy],
  );
  return { busy, play };
}
