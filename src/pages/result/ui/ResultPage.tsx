import { useCallback, useEffect, useMemo } from 'react';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Screen } from '@/shared/ui';
import { startSession, useSession } from '@/entities/play-session';
import { CATALOG, loadChart } from '@/entities/track';
import { ResultBreakdown } from '@/widgets/result-breakdown';
import { ChallengeButton } from '@/widgets/duel-challenge';
import { DuelVerdict } from '@/features/duel';
import { clearActiveDuel, useActiveDuel } from '@/entities/duel';
import { useCatalogState } from '@/widgets/track-list';
import { AttemptLine } from '@/widgets/history-panel';
import { OnlineLeaderboard } from '@/widgets/online-leaderboard';
import { CrystalsEarned } from '@/widgets/wallet-badge';

export function ResultPage() {
  const { chart, result, resultMeta, source } = useSession((s) => s);

  useEffect(() => {
    if (!chart || !result) navigate('menu');
  }, [chart, result]);

  const retry = useCallback(() => navigate('game'), []);
  // The run answers a duel when it was started from a challenge link.
  const duel = useActiveDuel();
  const answering = duel && result && duel.track === result.trackId ? duel : null;

  // "Next": the following playable catalog track (hidden for custom songs and after the last one).
  const catalog = useCatalogState();
  const nextId = useMemo(() => {
    if (source !== 'catalog' || !result) return null;
    const i = CATALOG.findIndex((t) => t.id === result.trackId);
    for (let j = i + 1; j < CATALOG.length; j++) if (catalog.unlocks.get(CATALOG[j].id)?.unlocked) return CATALOG[j].id;
    return null;
  }, [source, result, catalog]);
  const next = useCallback(async () => {
    if (!nextId) return;
    clearActiveDuel();
    startSession(await loadChart(nextId), 'catalog');
    navigate('game');
  }, [nextId]);

  if (!chart || !result) return null;

  // Progression celebrations: the daily bonus star as a pill; completed goals as a row of badges.
  const notes: string[] = [];
  if (resultMeta?.dailyBonus) notes.push(dict.dailyBonus);

  return (
    <Screen center>
      <ResultBreakdown
        result={result}
        meta={resultMeta}
        title={chart.title}
        subtitle={`★ ${chart.chart.stars}`}
        onRetry={retry}
        onNext={nextId ? () => void next() : undefined}
        chart={chart}
        notes={notes}
        goals={resultMeta?.goalsCompleted}
        extraTop={answering ? <DuelVerdict duel={answering} result={result} /> : undefined}
        extraActions={source === 'catalog' ? <ChallengeButton result={result} title={chart.title} /> : undefined}
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
