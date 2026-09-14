import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxMilestone, sfxRank } from '@/shared/lib/audio';
import { Button, Stars } from '@/shared/ui';
import { parseChartLevel, parseSections, type ChartFile, type ParsedNote, type Section } from '@/entities/chart';
import { densestSlice, formatClock, summarizeTimeline, type PlayResult, type TimeRange } from '@/entities/score';
import type { PlaySession } from '@/entities/play-session';
import { voice } from '@/features/voice-feedback';
import { SongStrip } from './SongStrip';
import { AccuracyChart } from './AccuracyChart';
import { BestMomentReplay } from './BestMomentReplay';
import { ShareRow } from './ShareRow';
import { EarnedBadges } from './EarnedBadges';
import { useCountUp } from '../lib/useCountUp';
import './result.css';

interface Props {
  result: PlayResult;
  meta: PlaySession['resultMeta'];
  title: string;
  subtitle: ReactNode;
  onRetry: () => void;
  /** "Next" — the following playable track; hidden when there is none or the run failed. */
  onNext?: () => void;
  /** Extra one-line celebrations (daily bonus), one per entry. */
  notes?: readonly string[];
  /** Achievements completed by this run (goal ids) — shown as a row of badges. */
  goals?: readonly string[];
  /** Optional compact line rendered right under the breakdown grid (e.g. attempt history). */
  belowGrid?: ReactNode;
  /** The chart that was played: lane-section bands under the strip and notes for the replay. */
  chart?: ChartFile;
  /** Slot right under the title (e.g. a "goal completed" line). */
  extraTop?: ReactNode;
  /** Slot above the actions (e.g. history line, online leaderboard). */
  extraBottom?: ReactNode;
  /** An extra button in the secondary actions row (e.g. "challenge a friend"). */
  extraActions?: ReactNode;
}

/** Replay length, seconds. */
const REPLAY_LENGTH = 8;
const DEFAULT_SECTIONS: readonly Section[] = [{ time: 0, lanes: 4 }];
const NO_NOTES: readonly ParsedNote[] = [];

/**
 * Result screen body: rank, breakdown, near-miss hint and a dominant RETRY (GDD §1.3), followed by
 * "where did I miss" — song strip, accuracy/combo chart, highlights, best-moment replay and sharing.
 */
export function ResultBreakdown({
  result,
  meta,
  title,
  subtitle,
  onRetry,
  onNext,
  notes: noteLines,
  goals,
  belowGrid,
  chart,
  extraTop,
  extraBottom,
  extraActions,
}: Props) {
  const starsGained = meta ? Math.max(0, meta.starsAfter - meta.starsBefore) : 0;
  const [details, setDetails] = useState(false);
  // The numbers run up after the rank lands; the score last and longest, then it pops.
  const score = useCountUp(result.score, 1300, 350);
  const accuracy = useCountUp(Math.round(result.accuracy * 1000), 900, 350);
  const combo = useCountUp(result.maxCombo, 900, 350);
  useEffect(() => {
    if (score.done && result.score > 0 && !result.failed) sfxMilestone();
  }, [score.done, result.score, result.failed]);

  useEffect(() => {
    if (result.failed) {
      voice.say('ne-sdavaysya', true);
      return;
    }
    // A chime per star as it pops in (see Stars: 0.3 s, then every 0.38 s).
    const timers = Array.from({ length: result.stars }, (_, i) => window.setTimeout(sfxRank, 300 + i * 380));
    if (result.stars >= 3) voice.say('rank-s', true);
    else if (result.fullCombo) voice.say('full-combo', true);
    else if (meta?.newRecord) voice.say('new-record', true);
    else voice.say('eshche-razok', true);
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [result, meta]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') onRetry();
      if (e.code === 'Escape') navigate('menu');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRetry]);

  const sections = useMemo<readonly Section[]>(() => (chart ? parseSections(chart.chart) : DEFAULT_SECTIONS), [chart]);
  const notes = useMemo<readonly ParsedNote[]>(() => (chart ? parseChartLevel(chart.chart) : NO_NOTES), [chart]);
  const timeline = result.timeline;
  const duration = result.duration > 0 ? result.duration : (chart?.duration ?? 0);
  const hasTimeline = timeline.t.length > 0 && duration > 0;
  const highlights = useMemo(() => summarizeTimeline(timeline, duration), [timeline, duration]);
  const replayRange = useMemo<TimeRange | null>(() => {
    const s = highlights.bestStreak;
    if (!s || notes.length === 0) return null;
    const r = densestSlice(timeline.t, s.from, s.to, REPLAY_LENGTH);
    const from = Math.max(0, Math.min(r.from, duration - REPLAY_LENGTH));
    return { from, to: from + REPLAY_LENGTH };
  }, [highlights, notes, timeline, duration]);

  const rows: Array<[string, number, string]> = [
    [dict.perfect, result.counts.perfect, '#ffffff'],
    [dict.great, result.counts.great, '#00f0ff'],
    [dict.good, result.counts.good, '#b6ff00'],
    [dict.miss, result.counts.miss, '#ff2bd6'],
  ];

  const items: Array<{ key: string; color: string; text: string }> = [];
  if (hasTimeline) {
    const s = highlights.bestStreak;
    if (s) {
      items.push({
        key: 'streak',
        color: '#00f0ff',
        text: fmt(dict.resultBestStreak, { n: s.count, noun: plural(s.count, dict.notesNoun), from: formatClock(s.from), to: formatClock(s.to) }),
      });
    }
    if (highlights.firstMiss !== null) {
      items.push({ key: 'miss', color: '#ff2bd6', text: fmt(dict.resultFirstMiss, { t: formatClock(highlights.firstMiss) }) });
    } else {
      items.push({ key: 'clean', color: '#b6ff00', text: dict.resultNoMiss });
    }
    const w = highlights.worstWindow;
    if (w && w.misses >= 2) {
      items.push({
        key: 'weak',
        color: '#ff8a00',
        text: fmt(dict.resultWeakSpot, {
          from: formatClock(w.from),
          to: formatClock(Math.ceil(w.to)),
          n: w.misses,
          noun: plural(w.misses, dict.missNoun),
        }),
      });
    }
  }

  const shareData = { title, artist: chart?.artist ?? '', result, sections };
  const fileName = fmt(dict.shareFileName, { id: result.trackId.replace(/[^\w-]+/g, '_') || 'result' });

  // One line that says what this run meant — the only analysis shown before "details".
  const failedAt = result.failed && hasTimeline ? timeline.t[timeline.t.length - 1] : null;
  const meaning = result.failed
    ? failedAt !== null && duration > 0
      ? fmt(dict.resultReachedAt, { at: formatClock(failedAt), total: formatClock(duration) })
      : dict.failedHint
    : starsGained > 0
      ? fmt(dict.starsEarned, { n: starsGained, noun: plural(starsGained, dict.starNoun) })
      : result.fullCombo
        ? dict.fullCombo
        : meta?.newRecord
          ? dict.newRecord
          : result.stars >= 3
            ? dict.resultStars3
            : result.stars === 2
              ? dict.resultStars2
              : dict.resultStars1;

  return (
    <div className="result">
      <div className="result-track">
        <div className="result-title">{title}</div>
        <div className="result-diff">{subtitle}</div>
      </div>
      {extraTop}

      {result.failed ? (
        <div className="result-rank result-failed">{dict.failed}</div>
      ) : (
        <div className="result-stars">
          <Stars value={result.stars} size="xl" animate />
        </div>
      )}
      {meaning && <div className={`result-meaning${result.failed ? ' is-failed' : ''}`}>{meaning}</div>}

      <div className="result-numbers">
        <div className={`result-number result-score${score.done && result.score > 0 ? ' is-done' : ''}`}>
          <b>{score.value.toLocaleString('ru-RU')}</b>
          <span className="micro">{dict.score}</span>
        </div>
        <div className="result-number">
          <b>{(accuracy.value / 10).toFixed(1)}%</b>
          <span className="micro">{dict.accuracy}</span>
        </div>
        <div className="result-number">
          <b>{combo.value}</b>
          <span className="micro">{dict.maxCombo}</span>
        </div>
        <div className="result-number">
          <b className={`rank-${result.rank}`}>{result.rank}</b>
          <span className="micro">{dict.rank}</span>
        </div>
      </div>

      {goals && goals.length > 0 && <EarnedBadges ids={goals} />}

      {noteLines && noteLines.length > 0 && (
        <div className="result-pills">
          {noteLines.map((n) => (
            <span key={n} className="result-pill">
              {n}
            </span>
          ))}
        </div>
      )}

      <div className="result-actions">
        {!result.failed && onNext && (
          <Button size="xl" onClick={onNext} autoFocus>
            {dict.next}
          </Button>
        )}
        <Button size={result.failed || !onNext ? 'xl' : 'md'} onClick={onRetry} autoFocus={result.failed || !onNext}>
          {dict.retry}
        </Button>
        <div className="result-secondary">
          <Button variant="ghost" onClick={() => navigate('menu')}>
            {dict.toMenu}
          </Button>
          <Button variant="ghost" onClick={() => setDetails((d) => !d)} aria-expanded={details}>
            {details ? dict.resultLess : dict.resultMore}
          </Button>
          {extraActions}
        </div>
      </div>

      {details && (
        <div className="result-details">
          <div className="result-grid">
            {rows.map(([label, n, color]) => (
              <div key={label} className="result-row">
                <span style={{ color }}>{label}</span>
                <b>{n}</b>
              </div>
            ))}
          </div>
          {belowGrid}

          {hasTimeline && (
            <>
              <section className="result-section">
                <h3 className="result-section-title">{dict.resultWhereMissed}</h3>
                <SongStrip timeline={timeline} sections={sections} duration={duration} />
              </section>

              <section className="result-section">
                <h3 className="result-section-title">{dict.resultChartTitle}</h3>
                <AccuracyChart timeline={timeline} duration={duration} />
              </section>

              {items.length > 0 && (
                <section className="result-section">
                  <h3 className="result-section-title">{dict.resultHighlights}</h3>
                  <ul className="result-highlights">
                    {items.map((it) => (
                      <li key={it.key} style={{ borderLeftColor: it.color }}>
                        {it.text}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {replayRange && highlights.bestStreak && (
                <section className="result-section">
                  <h3 className="result-section-title">{dict.resultReplay}</h3>
                  <div className="result-section-sub">
                    {fmt(dict.resultReplayHint, {
                      n: highlights.bestStreak.count,
                      noun: plural(highlights.bestStreak.count, dict.notesNoun),
                      from: formatClock(replayRange.from),
                      to: formatClock(replayRange.to),
                    })}
                  </div>
                  <BestMomentReplay notes={notes} sections={sections} timeline={timeline} range={replayRange} />
                </section>
              )}
            </>
          )}

          <ShareRow data={shareData} fileName={fileName} />

          {extraBottom}
        </div>
      )}
    </div>
  );
}
