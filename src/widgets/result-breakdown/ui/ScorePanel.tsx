import { useEffect, useRef, type ReactNode } from 'react';
import { dict } from '@/shared/i18n';
import { sfxMilestone } from '@/shared/lib/audio';
import { Panel } from '@/shared/ui';
import type { Rank } from '@/entities/score';
import { formatAccuracy, formatScore } from '@/shared/lib/format';
import { useCountUp } from '../lib/useCountUp';
import { T, T_FAILED } from '../lib/timeline';

interface Props {
  score: number;
  accuracy: number;
  combo: number;
  rank: Rank;
  failed: boolean;
  /** The tag (pair) riding on the panel's top edge; `null` shows none. */
  tag: ReactNode;
  /** Jump to the final number. */
  settled: boolean;
  /** Tap = «Подробнее». */
  onPress: () => void;
  expanded: boolean;
}

/**
 * The score panel (spec §2.8): the 44 px score counting up (1.3 s from 1.6 s, one pop when it
 * lands) over one grey stats line — «Точность 98,6 %  Комбо 136  Ранг S». The final number sets
 * the width from the start, the counter is centred on top, so nothing shifts while counting.
 */
export function ScorePanel({ score, accuracy, combo, rank, failed, tag, settled, onPress, expanded }: Props) {
  const delay = failed ? T_FAILED.PANEL : T.PANEL;
  const count = useCountUp(score, settled ? 0 : T.COUNT * 1000, delay * 1000);
  // The chime belongs to the landing moment only — once, and not to a later settle.
  const chimed = useRef(false);
  useEffect(() => {
    if (!count.done || chimed.current) return;
    chimed.current = true;
    if (score > 0 && !failed && !settled) sfxMilestone();
  }, [count.done, score, failed, settled]);
  const gold = rank === 'S' || rank === 'SS';
  const final = formatScore(score);
  return (
    <div className={`result-panel${failed ? ' is-failed' : ''}`}>
      {tag !== null && tag !== undefined && <div className="result-tab">{tag}</div>}
      <Panel layout="score" onPress={onPress} className="result-score-panel" aria-label={expanded ? dict.resultLess : dict.resultMore} aria-expanded={expanded}>
        <span className={`result-score${count.done ? ' is-done' : ''}`}>
          {!count.done && (
            <span className="result-score-cnt" aria-hidden="true">
              {formatScore(count.value)}
            </span>
          )}
          <b className="result-score-final">{final}</b>
        </span>
        <span className="result-stats">
          <span>
            {dict.accuracy} <b>{formatAccuracy(accuracy)}</b>
          </span>
          <span>
            {dict.statCombo} <b>{combo}</b>
          </span>
          <span>
            {dict.rank} <b className={gold ? 'is-gold' : undefined}>{rank}</b>
          </span>
        </span>
      </Panel>
    </div>
  );
}
