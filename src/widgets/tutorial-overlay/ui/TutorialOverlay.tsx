import { dict, fmt } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import type { TutorialKind, TutorialStep } from '@/features/tutorial';
import './tutorial-overlay.css';

interface Props {
  step: TutorialStep | null;
  /** Index of `step` in the script and the script length (step dots). */
  index: number;
  total: number;
  /** 0..1 through the current step. */
  progress: number;
  /** The player already landed a hit in this step → encouragement. */
  succeeded: boolean;
  /** Show finger hints instead of key hints. */
  touch: boolean;
  onSkip: () => void;
}

/**
 * Caption layer above the game canvas: mechanic icon with a CSS-animated hint, title, text,
 * input hint, step dots and live encouragement. Pointer events pass through everywhere except
 * the skip button, so the canvas keeps receiving taps.
 */
export function TutorialOverlay({ step, index, total, progress, succeeded, touch, onSkip }: Props) {
  return (
    <div className="tut" aria-live="polite">
      {step && (
        <div className={`tut-card tut-kind-${step.kind}`} key={step.id}>
          <div className="tut-head">
            <MechanicIcon kind={step.kind} />
            <div className="tut-titles">
              <div className="tut-title">{step.title}</div>
              <div className="tut-step">{fmt(dict.tutorialStepOf, { n: index + 1, total })}</div>
            </div>
            <Button variant="ghost" className="tut-skip" onClick={onSkip}>
              {dict.tutorialSkip}
            </Button>
          </div>
          <div className="tut-text">{step.text}</div>
          <div className="tut-hint">{touch ? step.hintTouch : step.hintDesktop}</div>
          <div className="tut-foot">
            <div className="tut-dots">
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={`tut-dot ${i < index ? 'done' : i === index ? 'now' : ''}`} />
              ))}
            </div>
            <div className={`tut-great ${succeeded ? 'on' : ''}`}>{step.kind === 'free' ? dict.tutorialDone : dict.tutorialGreat}</div>
          </div>
          <div className="tut-bar">
            <div className="tut-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Simple inline SVG per mechanic; motion comes from CSS keyframes on the classed elements. */
function MechanicIcon({ kind }: { kind: TutorialKind }) {
  const props = { className: `tut-icon tut-icon-${kind}`, viewBox: '0 0 48 48', width: 48, height: 48, 'aria-hidden': true } as const;
  switch (kind) {
    case 'tap':
    case 'free':
      return (
        <svg {...props}>
          <rect x="16" y="2" width="16" height="44" rx="3" className="ic-lane" />
          <line x1="12" y1="38" x2="36" y2="38" className="ic-line" />
          <rect x="17" y="8" width="14" height="6" rx="2" className="ic-note ic-fall" />
          <circle cx="24" cy="38" r="5" className="ic-pulse" />
        </svg>
      );
    case 'hold':
      return (
        <svg {...props}>
          <rect x="16" y="2" width="16" height="44" rx="3" className="ic-lane" />
          <line x1="12" y1="38" x2="36" y2="38" className="ic-line" />
          <rect x="18" y="4" width="12" height="30" rx="4" className="ic-hold ic-fall-hold" />
          <circle cx="24" cy="38" r="5" className="ic-finger ic-hold-press" />
        </svg>
      );
    case 'slide':
      return (
        <svg {...props}>
          <rect x="4" y="2" width="18" height="44" rx="3" className="ic-lane" />
          <rect x="26" y="2" width="18" height="44" rx="3" className="ic-lane" />
          <line x1="2" y1="38" x2="46" y2="38" className="ic-line" />
          <path d="M9 6 H17 L39 30 H31 Z" className="ic-hold" />
          <circle cx="13" cy="38" r="5" className="ic-finger ic-slide-move" />
        </svg>
      );
    case 'roll':
      return (
        <svg {...props}>
          <rect x="16" y="2" width="16" height="44" rx="3" className="ic-lane" />
          <line x1="12" y1="38" x2="36" y2="38" className="ic-line" />
          <rect x="18" y="6" width="12" height="26" rx="4" className="ic-roll" />
          <line x1="18" y1="13" x2="30" y2="13" className="ic-stripe" />
          <line x1="18" y1="19" x2="30" y2="19" className="ic-stripe" />
          <line x1="18" y1="25" x2="30" y2="25" className="ic-stripe" />
          <circle cx="24" cy="38" r="5" className="ic-finger ic-roll-tap" />
          <text x="40" y="12" className="ic-count">3</text>
        </svg>
      );
    case 'circle':
      return (
        <svg {...props}>
          <circle cx="24" cy="24" r="11" className="ic-circle" />
          <circle cx="24" cy="24" r="20" className="ic-ring ic-shrink" />
          <text x="24" y="29" className="ic-num">1</text>
        </svg>
      );
    case 'lanes':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="9" height="40" rx="2" className="ic-lane ic-lane-a" />
          <rect x="14" y="4" width="9" height="40" rx="2" className="ic-lane ic-lane-b" />
          <rect x="25" y="4" width="9" height="40" rx="2" className="ic-lane ic-lane-c" />
          <rect x="36" y="4" width="9" height="40" rx="2" className="ic-lane ic-lane-d" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M6 24 Q12 8 18 24 T30 24 T42 24" className="ic-wave" />
          <circle cx="24" cy="24" r="4" className="ic-pulse" />
        </svg>
      );
  }
}
