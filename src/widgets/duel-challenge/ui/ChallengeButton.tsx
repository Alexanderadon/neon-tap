import { useEffect, useRef, useState } from 'react';
import { dict } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { useSettings } from '@/entities/settings';
import type { PlayResult } from '@/entities/score';
import { NicknameDialog } from '@/features/submit-score';
import { canChallenge, createChallenge, shareChallenge } from '@/features/duel';
import './challenge.css';

type Status = 'idle' | 'busy' | 'shared' | 'copied' | 'failed';

/** "Challenge a friend": hosts a duel from this run and hands the link to the share sheet (or the clipboard). */
export function ChallengeButton({ result, title }: { result: PlayResult; title: string }) {
  const nickname = useSettings((s) => s.nickname);
  const [status, setStatus] = useState<Status>('idle');
  const [askName, setAskName] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!canChallenge(result)) return null;

  const flash = (s: Status) => {
    setStatus(s);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus('idle'), 2600);
  };

  const challenge = async () => {
    if (status === 'busy') return;
    if (!nickname) {
      setAskName(true);
      return;
    }
    setStatus('busy');
    const duel = await createChallenge(result, nickname);
    if (!duel) {
      flash('failed');
      return;
    }
    flash(await shareChallenge(duel, title));
  };

  const label = status === 'shared' ? dict.duelSent : status === 'copied' ? dict.duelCopied : status === 'failed' ? dict.duelFailed : dict.duelChallenge;
  return (
    <>
      <Button
        variant="ghost"
        className={`duel-challenge${status === 'shared' || status === 'copied' ? ' is-done' : ''}`}
        onClick={() => void challenge()}
        disabled={status === 'busy'}
      >
        {label}
      </Button>
      <NicknameDialog open={askName} onSkip={() => setAskName(false)} />
    </>
  );
}
