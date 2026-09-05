import { useCallback, useEffect } from 'react';
import { navigate } from '@/shared/lib/router';
import { Screen } from '@/shared/ui';
import { useSession } from '@/entities/play-session';
import { ResultBreakdown } from '@/widgets/result-breakdown';
import { AttemptLine } from '@/widgets/history-panel';
import { OnlineLeaderboard } from '@/widgets/online-leaderboard';

export function ResultPage() {
  const { chart, result, resultMeta, source } = useSession((s) => s);

  useEffect(() => {
    if (!chart || !result) navigate('menu');
  }, [chart, result]);

  const retry = useCallback(() => navigate('game'), []);

  if (!chart || !result) return null;
  return (
    <Screen center>
      <ResultBreakdown
        result={result}
        meta={resultMeta}
        title={chart.title}
        subtitle={`★ ${chart.chart.stars}`}
        onRetry={retry}
        belowGrid={source === 'catalog' ? <AttemptLine trackId={result.trackId} /> : undefined}
      />
      <OnlineLeaderboard result={result} source={source} />
    </Screen>
  );
}
