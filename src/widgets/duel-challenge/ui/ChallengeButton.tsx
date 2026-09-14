import { useEffect, useRef, useState } from 'react';
import { dict } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import type { Duel } from '@/shared/api/duels';
import { useSettings } from '@/entities/settings';
import type { PlayResult } from '@/entities/score';
import { NicknameDialog } from '@/features/submit-score';
import { canChallenge, challengeText, createChallenge } from '@/features/duel';
import './challenge.css';

type Phase = 'idle' | 'creating' | 'ready' | 'failed';

/**
 * "Challenge a friend": the first tap hosts a duel from this run; then the link is handed over
 * with a second tap — the share sheet on phones (called straight from the tap, as browsers
 * require) or the clipboard. The nickname is asked once if it is still missing.
 */
export function ChallengeButton({ result, title }: { result: PlayResult; title: string }) {
  const nickname = useSettings((s) => s.nickname);
  const [phase, setPhase] = useState<Phase>('idle');
  const [duel, setDuel] = useState<Duel | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [askName, setAskName] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!canChallenge(result)) return null;

  const flash = (text: string) => {
    setNote(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNote(null), 2600);
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

  const share = () => {
    if (!duel) return;
    const text = challengeText(duel, title);
    if (typeof navigator.share === 'function') {
      navigator
        .share({ text })
        .then(() => flash(dict.duelSent))
        .catch(() => undefined);
      return;
    }
    void copy();
  };

  const copy = async () => {
    if (!duel) return;
    try {
      await navigator.clipboard.writeText(challengeText(duel, title));
      flash(dict.duelCopied);
    } catch {
      flash(dict.duelFailed);
    }
  };

  if (phase === 'ready' && duel) {
    return (
      <div className="duel-share">
        <Button variant="ghost" onClick={share}>
          {dict.duelShare}
        </Button>
        <Button variant="ghost" onClick={() => void copy()}>
          {dict.duelCopy}
        </Button>
        {note && <span className="duel-share-note">{note}</span>}
      </div>
    );
  }
  return (
    <>
      <Button variant="ghost" className="duel-challenge" onClick={() => void create()} disabled={phase === 'creating'}>
        {phase === 'failed' ? dict.duelFailed : phase === 'creating' ? dict.duelCreating : dict.duelChallenge}
      </Button>
      <NicknameDialog open={askName} onSkip={() => setAskName(false)} />
    </>
  );
}
