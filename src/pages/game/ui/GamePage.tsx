import { useEffect } from 'react';
import { navigate } from '@/shared/lib/router';
import { useSession } from '@/entities/play-session';
import { GameCanvas } from '@/widgets/game-canvas';

export function GamePage() {
  const { chart, source, audioBuffer } = useSession((s) => s);

  useEffect(() => {
    if (!chart) navigate('menu');
  }, [chart]);

  if (!chart) return null;
  return <GameCanvas chart={chart} source={source} audioBuffer={audioBuffer} />;
}
