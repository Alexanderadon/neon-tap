import { useCallback, useEffect } from 'react';
import { navigate } from '@/shared/lib/router';
import { Screen } from '@/shared/ui';
import { useSession } from '@/entities/play-session';
import { ResultBreakdown } from '@/widgets/result-breakdown';

export function ResultPage() {
  const { chart, result, resultMeta } = useSession((s) => s);

  useEffect(() => {
    if (!chart || !result) navigate('menu');
  }, [chart, result]);

  const retry = useCallback(() => navigate('game'), []);

  if (!chart || !result) return null;
  return (
    <Screen center>
      <ResultBreakdown result={result} meta={resultMeta} title={chart.title} subtitle={`★ ${chart.chart.stars}`} onRetry={retry} />
    </Screen>
  );
}
