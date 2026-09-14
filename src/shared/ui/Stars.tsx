import type { CSSProperties } from 'react';
import './ui.css';

interface Props {
  /** Filled stars. */
  value: number;
  max?: number;
  /** sm = inline text (16 px), md = card accent (26 px), xl = the result screen's hero. */
  size?: 'sm' | 'md' | 'xl';
  /** Pop the stars in one after another (the result screen). */
  animate?: boolean;
  className?: string;
}

/** Five-point star in a 24 × 24 box, tip up. */
const STAR_PATH = 'M12 1.5 14.97 8.41 22.46 9.1 16.81 14.06 18.47 21.4 12 17.56 5.53 21.4 7.19 14.06 1.54 9.1 9.03 8.41Z';
/** Seconds before the first star pops and between stars. */
const POP_DELAY = 0.3;
const POP_STEP = 0.38;

/**
 * Level stars — the game's currency, drawn the same everywhere: a gold neon star with a lit
 * top-left facet and a white rim when earned, a faint outline while it is still to be won.
 */
export function Stars({ value, max = 3, size = 'sm', animate = false, className }: Props) {
  const cls = ['stars', `stars-${size}`, animate && 'stars-animate', className].filter(Boolean).join(' ');
  return (
    <span className={cls} aria-label={`${value} / ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < value;
        const style: CSSProperties | undefined = animate ? { animationDelay: `${(POP_DELAY + i * POP_STEP).toFixed(2)}s` } : undefined;
        return (
          <svg key={i} className={on ? 'star star-on' : 'star'} viewBox="0 0 24 24" style={style} aria-hidden="true">
            <path className="star-body" d={STAR_PATH} />
            {on && <path className="star-shine" d="M12 3.6 13.6 7.9 9.6 9.2 4.2 9.7 8.1 13.1 7.2 17.5 12 14.9Z" />}
          </svg>
        );
      })}
    </span>
  );
}
