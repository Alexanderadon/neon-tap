import { useCallback, useEffect, useState } from 'react';
import { leaderboard, type LeaderboardEntry } from '@/shared/api/leaderboard';
import { useSettings } from '@/entities/settings';
import type { ChartSource } from '@/entities/play-session';
import type { PlayResult } from '@/entities/score';
import { isEligible, submitScore } from '../model/submitScore';

export type SubmitStatus =
  /** Not a catalog run / failed — nothing to do. */
  | 'idle'
  /** Waiting for the enabled probe. */
  | 'probing'
  /** Backend not configured. */
  | 'disabled'
  /** Enabled, but the player has no nickname yet → show the dialog. */
  | 'need-name'
  | 'submitting'
  /** Submitted (or skipped without a name); `top`/`position` are ready. */
  | 'done'
  /** Skipped the nickname: table loaded, nothing submitted. */
  | 'anonymous'
  | 'error';

export interface SubmitState {
  status: SubmitStatus;
  top: LeaderboardEntry[];
  position: number | null;
  improved: boolean;
}

/** Remembered for the session so the dialog does not nag after "not now". */
let declinedThisSession = false;

const EMPTY: SubmitState = { status: 'idle', top: [], position: null, improved: false };

/**
 * Drives the online submission for the result screen: probes the backend once, asks for a
 * nickname when missing, posts the score and hands back the top list + the player's position.
 */
export function useSubmitScore(result: PlayResult | null, source: ChartSource): SubmitState & { skipNickname: () => void } {
  const nickname = useSettings((s) => s.nickname);
  const [declined, setDeclined] = useState(declinedThisSession);
  const [state, setState] = useState<SubmitState>(EMPTY);
  const eligible = isEligible(result, source);

  useEffect(() => {
    if (!eligible || !result) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((s) => (s.status === 'idle' ? { ...EMPTY, status: 'probing' } : s));
    (async () => {
      const enabled = await leaderboard.isEnabled();
      if (cancelled) return;
      if (!enabled) {
        setState({ ...EMPTY, status: 'disabled' });
        return;
      }
      if (!nickname) {
        if (!declined) {
          setState({ ...EMPTY, status: 'need-name' });
          return;
        }
        const top = await leaderboard.fetchTop(result.trackId);
        if (!cancelled) setState({ status: 'anonymous', top: top.top, position: null, improved: false });
        return;
      }
      setState((s) => ({ ...s, status: 'submitting' }));
      const r = await submitScore(result, nickname);
      if (cancelled) return;
      if (r.ok) setState({ status: 'done', top: r.top, position: r.position, improved: r.improved });
      else if (!r.enabled) setState({ ...EMPTY, status: 'disabled' });
      else {
        const top = await leaderboard.fetchTop(result.trackId, nickname);
        if (!cancelled) setState({ status: 'error', top: top.top, position: top.position, improved: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eligible, result, nickname, declined]);

  const skipNickname = useCallback(() => {
    declinedThisSession = true;
    setDeclined(true);
  }, []);

  return { ...state, skipNickname };
}
