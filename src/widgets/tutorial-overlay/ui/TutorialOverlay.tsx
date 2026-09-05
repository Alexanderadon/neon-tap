import { dict, fmt } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { zoneHint, type TutorialKind, type TutorialStep } from '@/features/tutorial';
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
 * input hint, a "lanes: N" chip with the key caps (desktop) or the touch zones (phones), step
 * dots and live encouragement. Pointer events pass through everywhere except the skip button,
 * so the canvas keeps receiving taps.
 */
export function TutorialOverlay({ step, index, total, progress, succeeded, touch, onSkip }: Props) {
  return (
    <div className="tut" aria-live="polite">
      {step && (
        <div className={`tut-card tut-kind-${step.kind}`} key={step.id}>
          <div className="tut-head">
            <MechanicIcon kind={step.kind} lanes={step.lanes} />
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
            <LanesChip lanes={step.lanes} keys={step.keys} touch={touch} />
            <div className={`tut-great ${succeeded ? 'on' : ''}`}>{step.id === 'finale' ? dict.tutorialDone : dict.tutorialGreat}</div>
          </div>
          <div className="tut-dots">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`tut-dot ${i < index ? 'done' : i === index ? 'now' : ''}`} />
            ))}
          </div>
          <div className="tut-bar">
            <div className="tut-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

/** "Полосы: N" + key caps (desktop) or the zone hint (touch). The card remounts per step, so the chip pops in with it. */
function LanesChip({ lanes, keys, touch }: { lanes: number; keys: readonly string[]; touch: boolean }) {
  return (
    <div className="tut-lanes">
      <span className="tut-lanes-n">{fmt(dict.tutorialLanes, { n: lanes })}</span>
      {touch ? (
        <span className="tut-lanes-zones">{zoneHint(lanes)}</span>
      ) : (
        <span className="tut-keys" aria-label={fmt(dict.tutorialLanesKeys, { keys: keys.join(' ') })}>
          {keys.map((k, i) => (
            <kbd key={i} className="tut-key">
              {k}
            </kbd>
          ))}
        </span>
      )}
    </div>
  );
}

/** Simple inline SVG per mechanic; motion comes from CSS keyframes on the classed elements. */
function MechanicIcon({ kind, lanes }: { kind: TutorialKind; lanes: number }) {
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
    case 'spell':
      // The slow-motion clock: a spinning hand and a glow that breathes.
      return (
        <svg {...props}>
          <circle cx="24" cy="24" r="18" className="ic-clock-glow ic-breathe" />
          <circle cx="24" cy="24" r="13" className="ic-clock" />
          <line x1="24" y1="24" x2="24" y2="14" className="ic-hand ic-hand-spin" />
          <line x1="24" y1="24" x2="31" y2="24" className="ic-hand ic-hand-short" />
          <circle cx="24" cy="24" r="1.8" className="ic-hand-pin" />
        </svg>
      );
    case 'lanes':
      return <LanesIcon n={lanes} {...props} />;
    default:
      return (
        <svg {...props}>
          <path d="M6 24 Q12 8 18 24 T30 24 T42 24" className="ic-wave" />
          <circle cx="24" cy="24" r="4" className="ic-pulse" />
        </svg>
      );
  }
}

/**
 * Lane-count icon: `n` bars grow out of the middle one after another (the lane morph), then
 * the whole field settles; the count sits in the corner.
 */
function LanesIcon({ n, ...props }: { n: number; className: string; viewBox: string; width: number; height: number; 'aria-hidden': true }) {
  const gap = 2;
  const w = (42 - gap * (n - 1)) / n;
  return (
    <svg {...props}>
      {Array.from({ length: n }, (_, i) => {
        const x = 3 + i * (w + gap);
        // Bars spread from the centre: the outer ones appear last.
        const order = Math.abs(i - (n - 1) / 2);
        return <rect key={i} x={x} y="4" width={w} height="40" rx="2" className="ic-lane ic-lane-grow" style={{ animationDelay: `${order * 0.12}s`, transformOrigin: `${x + w / 2}px 24px` }} />;
      })}
      <line x1="2" y1="38" x2="46" y2="38" className="ic-line" />
      <text x="44" y="12" className="ic-count">
        {n}
      </text>
    </svg>
  );
}
