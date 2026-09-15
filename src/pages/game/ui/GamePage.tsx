import { useEffect } from 'react';
import { navigate } from '@/shared/lib/router';
import { useSession } from '@/entities/play-session';
import { CATALOG } from '@/entities/track';
import { GameCanvas } from '@/widgets/game-canvas';
import { TopBar } from '@/widgets/top-bar';

/** Tracks per chapter (the deck's grouping) — for the «Metal Song · Глава 1» line of the pause menu. */
const CHAPTER = 10;

export function GamePage() {
  const { chart, source, audioBuffer } = useSession((s) => s);

  useEffect(() => {
    if (!chart) navigate('menu');
  }, [chart]);

  if (!chart) return null;
  const index = source === 'catalog' ? CATALOG.findIndex((t) => t.id === chart.id) : -1;
  const chapter = index >= 0 ? Math.floor(index / CHAPTER) + 1 : undefined;
  return <GameCanvas chart={chart} source={source} audioBuffer={audioBuffer} header={<TopBar />} chapter={chapter} />;
}
