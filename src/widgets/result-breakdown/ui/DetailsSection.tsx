import { useMemo, type ReactNode } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { Panel } from '@/shared/ui';
import { parseChartLevel, parseSections, type ChartFile, type ParsedNote, type Section } from '@/entities/chart';
import { densestSlice, formatClock, summarizeTimeline, type PlayResult, type TimeRange } from '@/entities/score';
import { SongStrip } from './SongStrip';
import { AccuracyChart } from './AccuracyChart';
import { BestMomentReplay } from './BestMomentReplay';
import { ShareRow } from './ShareRow';

interface Props {
  result: PlayResult;
  title: string;
  chart?: ChartFile;
  /** Compact line right under the judgement grid (attempt history). */
  belowGrid?: ReactNode;
  /** Bottom slot (online leaderboard). */
  extraBottom?: ReactNode;
}

/** Replay length, seconds. */
const REPLAY_LENGTH = 8;
const DEFAULT_SECTIONS: readonly Section[] = [{ time: 0, lanes: 4 }];
const NO_NOTES: readonly ParsedNote[] = [];

/**
 * «Подробнее»: the judgement counts (Russian, misses in magenta), then "where did I miss" — song
 * strip, accuracy / combo chart, highlights in one grey, best-moment replay, sharing, leaderboard.
 */
export function DetailsSection({ result, title, chart, belowGrid, extraBottom }: Props) {
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

  const rows: Array<[string, number, boolean]> = [
    [dict.judgeWord.perfect, result.counts.perfect, false],
    [dict.judgeWord.great, result.counts.great, false],
    [dict.judgeWord.good, result.counts.good, false],
    [dict.judgeWord.miss, result.counts.miss, true],
  ];

  const items: Array<{ key: string; bad: boolean; text: string }> = [];
  if (hasTimeline) {
    const s = highlights.bestStreak;
    if (s) {
      items.push({
        key: 'streak',
        bad: false,
        text: fmt(dict.resultBestStreak, { n: s.count, noun: plural(s.count, dict.notesNoun), from: formatClock(s.from), to: formatClock(s.to) }),
      });
    }
    if (highlights.firstMiss !== null) {
      items.push({ key: 'miss', bad: true, text: fmt(dict.resultFirstMiss, { t: formatClock(highlights.firstMiss) }) });
    } else {
      items.push({ key: 'clean', bad: false, text: dict.resultNoMiss });
    }
    const w = highlights.worstWindow;
    if (w && w.misses >= 2) {
      items.push({
        key: 'weak',
        bad: true,
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
    <div className="result-details">
      <Panel className="result-grid">
        {rows.map(([label, n, bad]) => (
          <span key={label} className={bad ? 'result-row is-bad' : 'result-row'}>
            <span>{label}</span>
            <b>{n}</b>
          </span>
        ))}
      </Panel>
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
                  <li key={it.key} className={it.bad ? 'is-bad' : undefined}>
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
