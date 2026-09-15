import { dict, fmt } from '@/shared/i18n';
import { Panel, Tag } from '@/shared/ui';
import type { TutorialKind, TutorialStep } from '@/features/tutorial';
import './tutorial-overlay.css';

interface Props {
  step: TutorialStep | null;
  /** Index of `step` in the script and the script length (the «2 / 16» tag). */
  index: number;
  total: number;
  /** 0..1 through the current step. */
  progress: number;
  /** The player already landed a hit in this step → the step tag turns into «ОТЛИЧНО!». */
  succeeded: boolean;
  /** Show finger hints instead of key hints. */
  touch: boolean;
}

/**
 * The tutorial caption (screens-game.html, frames 12–13): a 335 × 112 Panel under the HUD chip
 * line — a 56 px disc with the mechanic's icon, the step's title 20/700 and hint 13, and the step
 * bar 8 px in the gold face; the dark «2 / 16» tag rides on the panel's top edge and becomes the
 * gold «ОТЛИЧНО!» after the first hit. No buttons: skipping lives in the pause menu. Pointer events
 * pass through, so the canvas keeps receiving taps.
 */
export function TutorialOverlay({ step, index, total, progress, succeeded, touch }: Props) {
  if (!step) return <div className="tut" aria-live="polite" />;
  const praise = step.id === 'finale' ? dict.tutorialDone : dict.tutorialGreat;
  return (
    <div className="tut" aria-live="polite">
      <div className="tut-wrap" key={step.id}>
        <div className="tut-step">
          {succeeded ? <Tag className="tut-step-great">{praise}</Tag> : <Tag variant="dark">{fmt(dict.tutorialStep, { n: index + 1, total })}</Tag>}
        </div>
        <Panel className="tut-card" aria-label={step.title}>
          <div className="tut-row">
            <span className="tut-mech" aria-hidden="true">
              <MechanicIcon kind={step.kind} lanes={step.lanes} />
            </span>
            <span className="tut-txt">
              <b>{step.title}</b>
              <small>{touch ? step.hintTouch : step.hintDesktop}</small>
            </span>
          </div>
          <div className="tut-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** Mechanic icons 40 px: cyan and white only, stroke 2, transform-only motion (CSS keyframes on the classed parts). */
function MechanicIcon({ kind, lanes }: { kind: TutorialKind; lanes: number }) {
  const props = { className: `tut-icon tut-icon-${kind}`, viewBox: '0 0 48 48', width: 40, height: 40, 'aria-hidden': true } as const;
  switch (kind) {
    case 'tap':
    case 'free':
      return (
        <svg {...props}>
          <rect x="16" y="2" width="16" height="44" rx="8" className="ic-lane" />
          <line x1="12" y1="36" x2="36" y2="36" className="ic-line" />
          <rect x="18" y="20" width="12" height="6" rx="3" className="ic-note ic-fall" />
          <circle cx="24" cy="36" r="5" className="ic-finger ic-press" />
        </svg>
      );
    case 'hold':
      return (
        <svg {...props}>
          <rect x="16" y="2" width="16" height="44" rx="8" className="ic-lane" />
          <line x1="12" y1="36" x2="36" y2="36" className="ic-line" />
          <rect x="18" y="4" width="12" height="30" rx="6" className="ic-note ic-fall-hold" />
          <circle cx="24" cy="36" r="5" className="ic-finger ic-hold-press" />
        </svg>
      );
    case 'slide':
      return (
        <svg {...props}>
          <rect x="4" y="2" width="18" height="44" rx="8" className="ic-lane" />
          <rect x="26" y="2" width="18" height="44" rx="8" className="ic-lane" />
          <line x1="2" y1="36" x2="46" y2="36" className="ic-line" />
          <path d="M9 6 H17 L39 30 H31 Z" className="ic-note" />
          <circle cx="13" cy="36" r="5" className="ic-finger ic-slide-move" />
        </svg>
      );
    case 'roll':
      return (
        <svg {...props}>
          <rect x="16" y="2" width="16" height="44" rx="8" className="ic-lane" />
          <line x1="12" y1="36" x2="36" y2="36" className="ic-line" />
          <rect x="18" y="6" width="12" height="26" rx="6" className="ic-note" />
          <line x1="18" y1="13" x2="30" y2="13" className="ic-stripe" />
          <line x1="18" y1="19" x2="30" y2="19" className="ic-stripe" />
          <line x1="18" y1="25" x2="30" y2="25" className="ic-stripe" />
          <circle cx="24" cy="36" r="5" className="ic-finger ic-roll-tap" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...props}>
          <circle cx="24" cy="24" r="11" className="ic-disc" />
          <circle cx="24" cy="24" r="20" className="ic-ring ic-shrink" />
          <circle cx="24" cy="24" r="5" className="ic-finger ic-press" />
        </svg>
      );
    case 'spell':
      // The slow-motion clock: a turning hand.
      return (
        <svg {...props}>
          <circle cx="24" cy="24" r="16" className="ic-ring" />
          <line x1="24" y1="24" x2="24" y2="12" className="ic-hand ic-hand-spin" />
          <line x1="24" y1="24" x2="31" y2="24" className="ic-hand" />
          <circle cx="24" cy="24" r="2" className="ic-finger" />
        </svg>
      );
    case 'spin':
      // The wheel: a ring with three blades that keep turning, and a finger circling it.
      return (
        <svg {...props}>
          <circle cx="24" cy="24" r="17" className="ic-ring" />
          <g className="ic-blades ic-spin-turn">
            <line x1="24" y1="24" x2="24" y2="10" className="ic-hand" />
            <line x1="24" y1="24" x2="36.1" y2="31" className="ic-hand" />
            <line x1="24" y1="24" x2="11.9" y2="31" className="ic-hand" />
          </g>
          <circle cx="24" cy="24" r="4" className="ic-disc" />
          <circle cx="24" cy="6" r="4" className="ic-finger ic-spin-orbit" />
        </svg>
      );
    case 'lanes':
      return <LanesIcon n={lanes} {...props} />;
    default:
      return (
        <svg {...props}>
          <path d="M6 24 Q12 8 18 24 T30 24 T42 24" className="ic-wave" />
          <circle cx="24" cy="24" r="5" className="ic-finger ic-press" />
        </svg>
      );
  }
}

/** Lane-count icon: `n` rounded lanes grow out of the middle one after another (the lane morph); two fingers press left and right. */
function LanesIcon({ n, ...props }: { n: number; className: string; viewBox: string; width: number; height: number; 'aria-hidden': true }) {
  const gap = 2;
  const w = (44 - gap * (n - 1)) / n;
  return (
    <svg {...props}>
      {Array.from({ length: n }, (_, i) => {
        const x = 2 + i * (w + gap);
        // Bars spread from the centre: the outer ones appear last.
        const order = Math.abs(i - (n - 1) / 2);
        return (
          <rect
            key={i}
            x={x}
            y="2"
            width={w}
            height="44"
            rx={Math.min(8, w / 2)}
            className="ic-lane ic-lane-grow"
            style={{ animationDelay: `${order * 0.12}s`, transformOrigin: `${x + w / 2}px 24px` }}
          />
        );
      })}
      <line x1="2" y1="36" x2="46" y2="36" className="ic-line" />
      <circle cx={2 + w / 2} cy="36" r="5" className="ic-finger ic-press" />
      {n > 1 && <circle cx={2 + (n - 1) * (w + gap) + w / 2} cy="36" r="5" className="ic-finger ic-press ic-press-late" />}
    </svg>
  );
}
