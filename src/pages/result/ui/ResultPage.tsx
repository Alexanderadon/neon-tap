import { useCallback, useEffect, useMemo, useRef } from 'react';
import { navigate } from '@/shared/lib/router';
import { Icon, ObjButton, Screen } from '@/shared/ui';
import { dict } from '@/shared/i18n';
import { startSession, useSession } from '@/entities/play-session';
import { CATALOG, CoverScene, TRACK_IDS, findTrack, loadChart } from '@/entities/track';
import { grandTotalStars, findGoal, nextUnlock, useProgress } from '@/entities/progress';
import { attemptsOf, useHistory } from '@/entities/history';
import {
  RESULT_TIMELINE as T,
  ResultBreakdown,
  SETTLE_SECONDS,
  lootOf,
  previousBest,
  starsGained,
  useSettled,
  type FlightTargets,
  type NextTrack,
  type RecordInfo,
  type UnlockInfoLine,
} from '@/widgets/result-breakdown';
import { ChallengeButton } from '@/widgets/duel-challenge';
import { TopBar } from '@/widgets/top-bar';
import { DuelVerdict } from '@/features/duel';
import { clearActiveDuel, useActiveDuel } from '@/entities/duel';
import { useCatalogState } from '@/widgets/track-list';
import { AttemptLine } from '@/widgets/history-panel';
import { OnlineLeaderboard } from '@/widgets/online-leaderboard';
import './result-page.css';

/** Tracks per chapter (the deck's «Глава N»). */
const CHAPTER = 10;
const NO_GOALS: readonly string[] = [];

/**
 * The result screen: the played track's cover as the scene, the top bar whose counters tick once
 * the loot has flown in, and the breakdown. Any tap before the timeline ends settles the screen.
 */
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
  const trackIndex = result ? CATALOG.findIndex((t) => t.id === result.trackId) : -1;
  const nextId = useMemo(() => {
    if (source !== 'catalog' || trackIndex < 0) return null;
    for (let j = trackIndex + 1; j < CATALOG.length; j++) if (catalog.unlocks.get(CATALOG[j].id)?.unlocked) return CATALOG[j].id;
    return null;
  }, [source, trackIndex, catalog]);
  const next = useCallback(async () => {
    if (!nextId) return;
    clearActiveDuel();
    startSession(await loadChart(nextId), 'catalog');
    navigate('game');
  }, [nextId]);
  const nextTrack = useMemo<NextTrack | undefined>(() => {
    const t = nextId ? findTrack(nextId) : undefined;
    return t ? { id: t.id, title: t.title, genre: t.genre } : undefined;
  }, [nextId]);

  // Loot: crystals of the run, stars added to the record, achievements (their crystals), the daily star.
  const goalIds = resultMeta?.goalsCompleted ?? NO_GOALS;
  const loot = useMemo(
    () =>
      lootOf({
        crystals: resultMeta?.crystals ?? 0,
        starsGained: starsGained(resultMeta),
        dailyBonus: resultMeta?.dailyBonus === true,
        goals: goalIds.map((id) => findGoal(id)).filter((g): g is NonNullable<typeof g> => !!g),
      }),
    [resultMeta, goalIds],
  );

  // The wallet already holds the run's rewards (saveResult ran first): the chips tick from before to now.
  const walletCrystals = useProgress((s) => s.crystals);
  const walletStars = useProgress((s) => grandTotalStars(s, TRACK_IDS));
  const bestNow = useProgress((s) => (result ? s.tracks[result.trackId]?.score : undefined));
  const attempts = useHistory((h) => (result ? attemptsOf(h, result.trackId) : undefined));

  const failed = result?.failed ?? false;
  const { settled, settle } = useSettled(failed ? SETTLE_SECONDS.failed : SETTLE_SECONDS.normal);
  const crystalsRef = useRef<HTMLElement | null>(null);
  const starsRef = useRef<HTMLElement | null>(null);
  const targets = useMemo<FlightTargets>(() => ({ crystal: crystalsRef, star: starsRef }), []);

  if (!chart || !result) return null;

  const isCatalog = source === 'catalog';
  const chapter = isCatalog && trackIndex >= 0 ? Math.floor(trackIndex / CHAPTER) + 1 : undefined;

  const record: RecordInfo | undefined = isCatalog
    ? {
        newRecord: resultMeta?.newRecord === true,
        // The save wrote the exact record it replaced; the attempt history (cap 50) is the fallback for older saves.
        previous: resultMeta?.bestBefore !== undefined ? resultMeta.bestBefore : attempts ? previousBest(attempts) : null,
        best: bestNow ?? null,
      }
    : undefined;

  // «до открытия Bouncer ★ 22 / 25» — the nearest star-gated track, the bar from before this run to now.
  let unlock: UnlockInfoLine | null = null;
  if (isCatalog) {
    const nu = nextUnlock([...catalog.unlocks.values()], catalog.stars);
    const t = nu ? findTrack(nu.id) : undefined;
    if (nu && t) unlock = { title: t.title, need: nu.need, have: nu.have, before: Math.max(0, nu.have - loot.starsDelta) };
  }

  const crystalsTick = failed ? walletCrystals : { from: walletCrystals - loot.crystalsDelta, to: walletCrystals, delay: T.TICK_CRYSTALS };
  const starsTick = failed ? walletStars : { from: walletStars - loot.starsDelta, to: walletStars, delay: T.TICK_STARS };

  return (
    <Screen frame className="result-screen">
      <CoverScene id={result.trackId} genre={chart.genre} position="fixed" />
      <div className={settled ? 'result-page is-settled' : 'result-page'} onPointerDown={settled ? undefined : settle}>
        <TopBar
          crystals={crystalsTick}
          stars={starsTick}
          crystalsRef={crystalsRef}
          starsRef={starsRef}
        />
        <ResultBreakdown
          result={result}
          meta={resultMeta}
          title={chart.title}
          chapter={chapter}
          onRetry={retry}
          onNext={nextId ? () => void next() : undefined}
          nextTrack={nextTrack}
          loot={loot}
          record={record}
          unlock={unlock}
          duelAction={
            isCatalog ? <ChallengeButton result={result} title={chart.title} /> : <ObjButton icon={<Icon name="duel" />} label={dict.duelKicker} disabled />
          }
          targets={targets}
          settled={settled}
          chart={chart}
          extraTop={answering ? <DuelVerdict duel={answering} result={result} /> : undefined}
          belowGrid={isCatalog ? <AttemptLine trackId={result.trackId} /> : undefined}
          extraBottom={<OnlineLeaderboard result={result} source={source} />}
        />
      </div>
    </Screen>
  );
}
