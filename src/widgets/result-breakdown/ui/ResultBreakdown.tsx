import { useEffect, useMemo, type ReactNode } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxRank } from '@/shared/lib/audio';
import { Button, Stars } from '@/shared/ui';
import { parseChartLevel, parseSections, type ChartFile, type ParsedNote, type Section } from '@/entities/chart';
import { densestSlice, formatClock, summarizeTimeline, type PlayResult, type TimeRange } from '@/entities/score';
import type { PlaySession } from '@/entities/play-session';
import { voice } from '@/features/voice-feedback';
import { SongStrip } from './SongStrip';
import { AccuracyChart } from './AccuracyChart';
import { BestMomentReplay } from './BestMomentReplay';
import { ShareRow } from './ShareRow';
import './result.css';

interface Props {
  result: PlayResult;
  meta: PlaySession['resultMeta'];
  title: string;
  subtitle: string;
  onRetry: () => void;
  /** The chart that was played: lane-section bands under the strip and notes for the replay. */
  chart?: ChartFile;
  /** Slot right under the title (e.g. a "goal completed" line). */
  extraTop?: ReactNode;
  /** Slot above the actions (e.g. history line, online leaderboard). */
  extraBottom?: ReactNode;
}

/** Replay length, seconds. */
const REPLAY_LENGTH = 8;
const DEFAULT_SECTIONS: readonly Section[] = [{ time: 0, lanes: 4 }];
const NO_NOTES: readonly ParsedNote[] = [];

/**
 * Result screen body: rank, breakdown, near-miss hint and a dominant RETRY (GDD §1.3), followed by
 * "where did I miss" — song strip, accuracy/combo chart, highlights, best-moment replay and sharing.
 */
export function ResultBreakdown({ result, meta, title, subtitle, onRetry, chart, extraTop, extraBottom }: Props) {
  const starsGained = meta ? Math.max(0, meta.starsAfter - meta.starsBefore) : 0;

  useEffect(() => {
    if (result.failed) {
      voice.say('ne-sdavaysya', true);
      return;
    }
    if (result.rank !== 'D') sfxRank();
    if (result.rank === 'SS' || result.rank === 'S') voice.say('rank-s', true);
    else if (result.fullCombo) voice.say('full-combo', true);
    else if (meta?.newRecord && result.rank !== 'D') voice.say('new-record', true);
    else voice.say('eshche-razok', true);
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

  return (
    <div className="result">
      <div className="result-track">
        <div className="result-title">{title}</div>
        <div className="result-diff">{subtitle}</div>
      </div>
      {extraTop}

      {result.failed ? (
        <>
          <div className="result-rank result-failed">{dict.failed}</div>
          <div className="result-failed-hint">{dict.failedHint}</div>
        </>
      ) : (
        <>
          <div className={`result-rank rank-${result.rank}`}>{result.rank}</div>
          <div className="result-acc">{(result.accuracy * 100).toFixed(2)}%</div>
        </>
      )}

      {result.fullCombo && <div className="result-badge result-fc">{dict.fullCombo}</div>}
      {meta?.newRecord && result.rank !== 'D' && <div className="result-badge result-record">{dict.newRecord}</div>}
      {starsGained > 0 && (
        <div className="result-stars">
          <Stars value={meta!.starsAfter} size="md" /> <span>{fmt(dict.starsEarned, { n: starsGained })}</span>
        </div>
      )}

      <div className="result-grid">
        {rows.map(([label, n, color]) => (
          <div key={label} className="result-row">
            <span style={{ color }}>{label}</span>
            <b>{n}</b>
          </div>
        ))}
        <div className="result-row">
          <span>{dict.maxCombo}</span>
          <b>{result.maxCombo}</b>
        </div>
        <div className="result-row">
          <span>{dict.score}</span>
          <b>{result.score.toLocaleString('ru-RU')}</b>
        </div>
      </div>

      {!result.failed && result.notesToS > 0 && result.accuracy > 0.9 && (
        <div className="result-nearmiss">
          {fmt(dict.toRankS, { n: result.notesToS, noun: plural(result.notesToS, ['ноты', 'нот', 'нот']) })}
        </div>
      )}

      <div className="result-actions">
        <Button size="xl" onClick={onRetry} autoFocus>
          {dict.retry}
        </Button>
        <Button variant="ghost" onClick={() => navigate('menu')}>
          {dict.toMenu}
        </Button>
        <div className="result-hint">{dict.pressRToRetry}</div>
      </div>

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
  );
}
