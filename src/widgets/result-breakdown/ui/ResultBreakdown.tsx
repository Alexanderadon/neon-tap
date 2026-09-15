import { createRef, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxRank, sfxTick } from '@/shared/lib/audio';
import { ActionZone, Disc, Headline, Icon, ObjButton, PrimaryAction, ProgressBar, Stars, Tag, Thumb, Trio } from '@/shared/ui';
import type { Genre } from '@/shared/types/chart';
import type { ChartFile } from '@/entities/chart';
import { formatClock, type PlayResult } from '@/entities/score';
import type { PlaySession } from '@/entities/play-session';
import { TrackCover } from '@/entities/track';
import { voice } from '@/features/voice-feedback';
import { formatScore } from '@/shared/lib/format';
import { flightsOf, type Loot } from '../lib/loot';
import { T } from '../lib/timeline';
import { verdictOf } from '../lib/verdict';
import { Confetti } from './Confetti';
import { DetailsSection } from './DetailsSection';
import { LootRow } from './LootRow';
import { RewardFlights, type FlightSource, type FlightTargets } from './RewardFlights';
import { ScorePanel } from './ScorePanel';
import './result.css';

/** The track's record, for the tag on the score panel. */
export interface RecordInfo {
  newRecord: boolean;
  /** The score this run beat (null on the first run, or unknown). */
  previous: number | null;
  /** The standing record when this run did not beat it. */
  best: number | null;
}

/** «до открытия Bouncer ★ 22 / 25»: the next star-gated track and the bar before / after this run. */
export interface UnlockInfoLine {
  title: string;
  need: number;
  have: number;
  before: number;
}

export interface NextTrack {
  id: string;
  title: string;
  genre?: Genre;
}

interface Props {
  result: PlayResult;
  meta: PlaySession['resultMeta'];
  title: string;
  /** Catalog chapter (1-based); omitted for custom songs. */
  chapter?: number;
  onRetry: () => void;
  /** "Next" — the following playable track; the primary becomes «ЕЩЁ РАЗ» without it or after a fail. */
  onNext?: () => void;
  nextTrack?: NextTrack;
  /** The three coins and the wallet deltas (see `lootOf`). */
  loot: Loot;
  record?: RecordInfo;
  unlock?: UnlockInfoLine | null;
  /** Third object button of the row (the duel challenge). */
  duelAction: ReactNode;
  /** Anchors of the wallet chips — the loot flies there. */
  targets: FlightTargets;
  /** The screen is in its final state (tap-to-skip / reduced motion). */
  settled: boolean;
  /** The chart that was played: lane-section bands under the strip and notes for the replay. */
  chart?: ChartFile;
  /** Slot right under the title line (the duel verdict). */
  extraTop?: ReactNode;
  /** Slots inside «Подробнее»: under the judgement grid (attempt history) and at the bottom (online leaderboard). */
  belowGrid?: ReactNode;
  extraBottom?: ReactNode;
}

/**
 * The result screen body (final.html): title line → hero stars 96 / 120 / 96 with sparks and
 * confetti → the «+2 ЗВЕЗДЫ» verdict → record tag on the score panel (count-up + one stats line)
 * → three loot coins that fly into the wallet → the unlock bar → «Ещё раз · В меню · Дуэль» and
 * «ДАЛЬШЕ · next track». Tapping the panel opens «Подробнее».
 */
export function ResultBreakdown({
  result,
  meta,
  title,
  chapter,
  onRetry,
  onNext,
  nextTrack,
  loot,
  record,
  unlock,
  duelAction,
  targets,
  settled,
  chart,
  extraTop,
  belowGrid,
  extraBottom,
}: Props) {
  const failed = result.failed;
  const [details, setDetails] = useState(false);
  const startedAt = useRef(performance.now());
  const verdict = useMemo(() => verdictOf(result, meta), [result, meta]);

  // Chimes on the timeline: a star each pop, the wallet ticks when the loot lands. A settle cuts the rest.
  useEffect(() => {
    if (settled || failed) return;
    const timers: number[] = [];
    for (let i = 0; i < result.stars; i++) timers.push(window.setTimeout(sfxRank, (T.STAR + i * T.STAR_STEP) * 1000));
    if (loot.crystalsDelta > 0) timers.push(window.setTimeout(() => sfxTick('crystals'), T.TICK_CRYSTALS * 1000));
    if (loot.starsDelta > 0) timers.push(window.setTimeout(() => sfxTick('stars'), T.TICK_STARS * 1000));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [settled, failed, result.stars, loot.crystalsDelta, loot.starsDelta]);

  useEffect(() => {
    if (failed) {
      voice.say('ne-sdavaysya', true);
      return;
    }
    if (result.stars >= 3) voice.say('rank-s', true);
    else if (result.fullCombo) voice.say('full-combo', true);
    else if (meta?.newRecord) voice.say('new-record', true);
    else voice.say('eshche-razok', true);
  }, [failed, result.stars, result.fullCombo, meta?.newRecord]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') onRetry();
      if (e.code === 'Escape') navigate('menu');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRetry]);

  // Loot coin anchors (the flights start from their centres).
  const coinRefs = useMemo(() => loot.coins.map(() => createRef<HTMLSpanElement>()), [loot]);
  const sources = useMemo<FlightSource[]>(
    () => (failed ? [] : flightsOf(loot).map((f) => ({ kind: f.kind, count: f.count, from: coinRefs[f.coin] as RefObject<HTMLElement | null> }))),
    [failed, loot, coinRefs],
  );

  // The tag riding on the panel: the record, or where the run stopped.
  const timeline = result.timeline;
  const duration = result.duration > 0 ? result.duration : (chart?.duration ?? 0);
  const failedAt = failed && timeline.t.length > 0 ? timeline.t[timeline.t.length - 1] : null;
  let tag: ReactNode = null;
  if (failed) {
    tag = (
      <Tag variant="dark">
        {failedAt !== null && duration > 0 ? fmt(dict.resultReachedAt, { at: formatClock(failedAt), total: formatClock(duration) }) : dict.tagFailedHearts}
      </Tag>
    );
  } else if (record?.newRecord) {
    tag =
      record.previous !== null ? (
        <>
          <Tag shape="left" shine={!settled}>
            {dict.tagNewRecord}
          </Tag>
          <Tag variant="dark" shape="right">
            {fmt(dict.tagWas, { score: formatScore(record.previous) })}
          </Tag>
        </>
      ) : (
        <Tag shine={!settled}>{dict.tagNewRecord}</Tag>
      );
  } else if (record && record.best !== null) {
    tag = <Tag variant="dark">{fmt(dict.tagRecord, { score: formatScore(record.best) })}</Tag>;
  }

  const primaryNext = !failed && onNext && nextTrack;
  const rootCls = ['result', failed && 'is-failed', settled && 'is-settled'].filter(Boolean).join(' ');

  return (
    <div className={rootCls}>
      <div className="result-sub">
        <b>{title}</b>
        {chapter !== undefined && (
          <>
            <span className="result-sub-dot">·</span>
            <span>{fmt(dict.deckChapter, { n: chapter })}</span>
          </>
        )}
      </div>
      {extraTop}

      <div className="result-hero">
        <Stars value={failed ? 0 : result.stars} size="hero" animate />
        {!failed && result.stars > 0 && <Confetti />}
      </div>

      <Headline as="div" pop tone={verdict.kind === 'failed' ? 'mag' : 'gold'} className={`result-verdict${verdict.kind === 'failed' ? ' is-failed' : ''}`}>
        {verdict.text}
      </Headline>

      <ScorePanel
        score={result.score}
        accuracy={result.accuracy}
        combo={result.maxCombo}
        rank={result.rank}
        failed={failed}
        tag={tag}
        settled={settled}
        expanded={details}
        onPress={() => setDetails((d) => !d)}
      />

      {!failed && <LootRow loot={loot} coinRefs={coinRefs} />}

      {unlock && (
        <div className="result-unlock">
          <ProgressBar
            value={unlock.have / unlock.need}
            base={unlock.before / unlock.need}
            label={
              <>
                {dict.unlockTo} <b>{unlock.title}</b>
              </>
            }
            right={
              <>
                <Stars value={1} max={1} />
                {fmt(dict.unlockCount, { have: unlock.have, need: unlock.need })}
              </>
            }
            animate={!failed}
            delay={T.UNLOCK_GROW}
          />
        </div>
      )}

      {details && <DetailsSection result={result} title={title} chart={chart} belowGrid={belowGrid} extraBottom={extraBottom} />}

      <ActionZone className="result-actions">
        <Trio className="result-trio">
          {failed ? (
            <>
              <ObjButton icon={<Icon name="home" />} label={dict.toMenu} onClick={() => navigate('menu')} />
              <ObjButton
                icon={<Icon name="file" />}
                label={details ? dict.resultLess : dict.resultMore}
                onClick={() => setDetails((d) => !d)}
                aria-expanded={details}
              />
            </>
          ) : (
            <>
              <ObjButton icon={<Icon name="retry" />} label={dict.retry} onClick={onRetry} />
              <ObjButton icon={<Icon name="home" />} label={dict.toMenu} onClick={() => navigate('menu')} />
            </>
          )}
          {duelAction}
        </Trio>
        <div className="result-primary">
          {primaryNext ? (
            <PrimaryAction
              lead={
                <Thumb>
                  <TrackCover id={nextTrack.id} genre={nextTrack.genre} title={nextTrack.title} />
                </Thumb>
              }
              label={dict.next}
              sub={nextTrack.title}
              beat
              onClick={onNext}
              autoFocus
            />
          ) : (
            <PrimaryAction
              lead={
                <Disc>
                  <Icon name="retry" size={24} />
                </Disc>
              }
              label={dict.retry}
              sub={title}
              beat
              onClick={onRetry}
              autoFocus
            />
          )}
        </div>
      </ActionZone>

      <RewardFlights sources={sources} targets={targets} startedAt={startedAt.current} enabled={!settled && !failed} />
    </div>
  );
}
