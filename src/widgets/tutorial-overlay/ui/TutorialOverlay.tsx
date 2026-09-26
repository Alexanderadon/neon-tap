import { dict, fmt } from '@/shared/i18n';
import { CaptionCard, type CaptionStep } from '@/features/play-chart';

interface Props {
  step: CaptionStep | null;
  /** Index of `step` in the script and the script length (the «2 / 9» tag). */
  index: number;
  total: number;
  /** 0..1 through the current step. */
  progress: number;
  /** The player already landed a hit in this step → the step tag turns into «ОТЛИЧНО!». */
  succeeded: boolean;
  /** The step plays its second time (nothing was hit the first): the tag says «Ещё разок», so the jump back reads as a second try, not a glitch. */
  again?: boolean;
  /** Show finger hints instead of key hints. */
  touch: boolean;
}

/**
 * The tutorial caption (screens-game.html, frames 12–13): the caption card under the HUD chip line —
 * the step's mechanic, title and hint, the step bar — with the dark «2 / 9» tag on its top edge («Ещё разок»
 * while a step replays) that becomes the gold «ОТЛИЧНО!» after the first hit. No buttons: skipping lives in the pause menu. The
 * card itself is the play feature's (a run shows the same one when a mechanic is met for the first time).
 */
export function TutorialOverlay({ step, index, total, progress, succeeded, again = false, touch }: Props) {
  const praise = step?.id === 'finale' ? dict.tutorialDone : dict.tutorialGreat;
  const tag = succeeded ? praise : again ? dict.tutorialAgain : fmt(dict.tutorialStep, { n: index + 1, total });
  return <CaptionCard step={step} tag={tag} gold={succeeded} progress={progress} touch={touch} />;
}
