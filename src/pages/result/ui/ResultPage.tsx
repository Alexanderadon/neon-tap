import { useCallback, useEffect } from 'react';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Screen } from '@/shared/ui';
import { useSession } from '@/entities/play-session';
import { ResultBreakdown } from '@/widgets/result-breakdown';

export function ResultPage() {
  const { chart, difficulty, result, resultMeta } = useSession((s) => s);

  useEffect(() => {
    if (!chart || !result) navigate('menu');
  }, [chart, result]);

  const retry = useCallback(() => navigate('game'), []);

  if (!chart || !result) return null;
  return (
    <Screen center>
      <ResultBreakdown result={result} meta={resultMeta} title={chart.title} difficultyLabel={dict.difficulty[difficulty]} onRetry={retry} />
    </Screen>
  );
}
