import { useEffect, useRef, useState } from 'react';
import { dict } from '@/shared/i18n';
import { Icon, ObjButton } from '@/shared/ui';
import type { Duel } from '@/shared/api/duels';
import { useSettings } from '@/entities/settings';
import type { PlayResult } from '@/entities/score';
import { NicknameDialog } from '@/features/submit-score';
import { canChallenge, challengeText, createChallenge } from '@/features/duel';
import './challenge.css';

type Phase = 'idle' | 'creating' | 'ready' | 'sent' | 'failed';

/**
 * «Дуэль» — the third object button of the result's action row. The first tap hosts a duel from
 * this run; the button then reads «Поделиться» and the second tap hands the link over — the share
 * sheet on phones (called straight from the tap, as browsers require) or the clipboard, flashing
 * «Готово». The nickname is asked once if it is still missing. Runs that cannot be challenged
 * (failed, empty) keep the button in place, disabled — the row is always three.
 */
export function ChallengeButton({ result, title }: { result: PlayResult; title: string }) {
  const nickname = useSettings((s) => s.nickname);
  const [phase, setPhase] = useState<Phase>('idle');
  const [duel, setDuel] = useState<Duel | null>(null);
  const [askName, setAskName] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const allowed = canChallenge(result);

  const flash = (next: Phase) => {
    setPhase(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPhase('ready'), 2600);
  };

  const create = async () => {
    if (!nickname) {
      setAskName(true);
      return;
    }
    setPhase('creating');
    const d = await createChallenge(result, nickname);
    setDuel(d);
    setPhase(d ? 'ready' : 'failed');
  };

  const copy = async () => {
    if (!duel) return;
    try {
      await navigator.clipboard.writeText(challengeText(duel, title));
      flash('sent');
    } catch {
      flash('failed');
    }
  };

  const share = () => {
    if (!duel) return;
    const text = challengeText(duel, title);
    if (typeof navigator.share === 'function') {
      navigator
        .share({ text })
        .then(() => flash('sent'))
        .catch(() => undefined);
      return;
    }
    void copy();
  };

  const tap = () => {
    if (phase === 'creating') return;
    if (duel && (phase === 'ready' || phase === 'sent' || phase === 'failed')) share();
    else void create();
  };

  const label =
    phase === 'creating'
      ? dict.duelCreating
      : phase === 'sent'
        ? dict.duelDoneShort
        : phase === 'failed'
          ? dict.duelErrorShort
          : phase === 'ready'
            ? dict.duelShare
            : dict.duelKicker;
  const icon = phase === 'sent' ? 'check' : phase === 'ready' ? 'tray' : 'duel';
  const cls = ['duel-challenge', phase === 'sent' && 'is-sent', phase === 'failed' && 'is-failed'].filter(Boolean).join(' ');

  return (
    <>
      <ObjButton
        className={cls}
        icon={<Icon name={icon} />}
        label={label}
        onClick={tap}
        disabled={!allowed || phase === 'creating'}
        aria-label={allowed ? dict.duelChallenge : undefined}
        title={allowed ? dict.duelChallenge : undefined}
      />
      <NicknameDialog open={askName} onSkip={() => setAskName(false)} />
    </>
  );
}
