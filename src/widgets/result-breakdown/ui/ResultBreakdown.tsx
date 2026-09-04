import { useEffect } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Button, Stars } from '@/shared/ui';
import type { PlayResult } from '@/entities/score';
import type { PlaySession } from '@/entities/play-session';
import { voice } from '@/features/voice-feedback';
import './result.css';

interface Props {
  result: PlayResult;
  meta: PlaySession['resultMeta'];
  title: string;
  difficultyLabel: string;
  onRetry: () => void;
}

/** Result screen body: rank, breakdown, near-miss hint and a dominant RETRY (GDD §1.3). */
export function ResultBreakdown({ result, meta, title, difficultyLabel, onRetry }: Props) {
  const starsGained = meta ? Math.max(0, meta.starsAfter - meta.starsBefore) : 0;

  useEffect(() => {
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

  const rows: Array<[string, number, string]> = [
    [dict.perfect, result.counts.perfect, '#ffffff'],
    [dict.great, result.counts.great, '#00f0ff'],
    [dict.good, result.counts.good, '#b6ff00'],
    [dict.miss, result.counts.miss, '#ff2bd6'],
  ];

  return (
    <div className="result">
      <div className="result-track">
        <div className="result-title">{title}</div>
        <div className="result-diff">{difficultyLabel}</div>
      </div>

      <div className={`result-rank rank-${result.rank}`}>{result.rank}</div>
      <div className="result-acc">{(result.accuracy * 100).toFixed(2)}%</div>

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

      {result.notesToS > 0 && result.accuracy > 0.9 && (
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
    </div>
  );
}
