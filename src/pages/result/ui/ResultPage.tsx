import { useCallback, useEffect } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Screen } from '@/shared/ui';
import { useSession } from '@/entities/play-session';
import { findGoal } from '@/entities/progress';
import { ResultBreakdown } from '@/widgets/result-breakdown';
import { AttemptLine } from '@/widgets/history-panel';
import { OnlineLeaderboard } from '@/widgets/online-leaderboard';
import { CrystalsEarned } from '@/widgets/wallet-badge';

export function ResultPage() {
  const { chart, result, resultMeta, source } = useSession((s) => s);

  useEffect(() => {
    if (!chart || !result) navigate('menu');
  }, [chart, result]);

  const retry = useCallback(() => navigate('game'), []);

  if (!chart || !result) return null;

  // Progression celebrations: daily bonus star and any goal this run completed (one line each).
  const notes: string[] = [];
  if (resultMeta?.dailyBonus) notes.push(dict.dailyBonus);
  const goalTitles = (resultMeta?.goalsCompleted ?? []).map((id) => findGoal(id)?.title).filter((t): t is string => !!t);
  if (goalTitles.length) notes.push(fmt(dict.goalCompleted, { title: goalTitles.join(' · ') }));

  return (
    <Screen center>
      <ResultBreakdown
        result={result}
        meta={resultMeta}
        title={chart.title}
        subtitle={`★ ${chart.chart.stars}`}
        onRetry={retry}
        chart={chart}
        notes={notes}
        belowGrid={
          <>
            {resultMeta?.crystals ? <CrystalsEarned n={resultMeta.crystals} /> : null}
            {source === 'catalog' && <AttemptLine trackId={result.trackId} />}
          </>
        }
        extraBottom={<OnlineLeaderboard result={result} source={source} />}
      />
    </Screen>
  );
}
