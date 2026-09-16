import { useEffect } from 'react';
import { navigate } from '@/shared/lib/router';
import { useSession } from '@/entities/play-session';
import { CATALOG, chapterAt, chapterTitle } from '@/entities/track';
import { GameCanvas } from '@/widgets/game-canvas';
import { TopBar } from '@/widgets/top-bar';

export function GamePage() {
  const { chart, source, audioBuffer } = useSession((s) => s);

  useEffect(() => {
    if (!chart) navigate('menu');
  }, [chart]);

  if (!chart) return null;
  const index = source === 'catalog' ? CATALOG.findIndex((t) => t.id === chart.id) : -1;
  // «Metal Song · Глава 1» / «Naomi · Рок-пак» in the pause menu.
  const chapter = index >= 0 ? chapterAt(index) : undefined;
  const chapterName = chapter ? chapterTitle(chapter) : undefined;
  return <GameCanvas chart={chart} source={source} audioBuffer={audioBuffer} header={<TopBar />} chapter={chapterName} />;
}
