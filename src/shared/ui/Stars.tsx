import { useId, type CSSProperties } from 'react';
import './stars.css';

export type StarsSize = 'sm' | 'md' | 'hero' | 'xl';

interface Props {
  /** Filled stars. */
  value: number;
  max?: number;
  /** sm = inline 16 px (chips, unlock bar), md = card row 26 px, hero = the result screen's 96 / 120 / 96 (xl is its old name). */
  size?: StarsSize;
  /** Pop the stars in one after another with sparks (the result screen). */
  animate?: boolean;
  /** Radial halo behind earned stars (default: hero only). */
  halo?: boolean;
  className?: string;
}

/** Five-point star in a 24 × 24 box, tip up. */
const STAR_PATH = 'M12 1.5 14.97 8.41 22.46 9.1 16.81 14.06 18.47 21.4 12 17.56 5.53 21.4 7.19 14.06 1.54 9.1 9.03 8.41Z';
/** The lit facet (upper-left of the body). */
const FACET_PATH = 'M12 4.2 13.6 8 9.9 9.4 5.4 9.8 8.6 12.7Z';
/** Seconds before the first star pops and between stars (spec §3: 0.3 / 0.7 / 1.1). */
const POP_DELAY = 0.3;
const POP_STEP = 0.4;
/** Sparks leave 0.15 s after their star lands. */
const SPARK_LAG = 0.15;
const SPARK_COUNT = 12;

/** Spark directions: twelve sticks around the star, jittered deterministically so the burst is not a perfect wheel. */
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, i) => ({
  angle: Math.round(i * 30 + ((i * 7) % 5) - 2),
  length: 56 + ((i * 11) % 21),
  gold: i % 2 === 0,
}));

/**
 * Level stars — the game's currency, drawn the same everywhere: a glossy 3D gold star (vertical
 * gradient face, white facet, dark-orange rim) when earned, the same shape in dark grey while it is
 * still to be won. The halo is a radial gradient inside the SVG — no CSS filters (iOS draws squares).
 */
export function Stars({ value, max = 3, size = 'sm', animate = false, halo, className }: Props) {
  const uid = useId().replace(/:/g, '');
  const hero = size === 'hero' || size === 'xl';
  const withHalo = halo ?? hero;
  const cls = ['stars', hero ? 'stars-hero' : `stars-${size}`, animate && 'stars-animate', className].filter(Boolean).join(' ');
  const bigIndex = max % 2 === 1 ? (max - 1) / 2 : -1;
  return (
    <span className={cls} aria-label={`${value} / ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < value;
        const delay = POP_DELAY + i * POP_STEP;
        const wrapCls = ['star-wrap', on ? 'star-wrap-on' : 'star-wrap-off', hero && i === bigIndex && 'star-wrap-big'].filter(Boolean).join(' ');
        const style: CSSProperties | undefined = animate ? { animationDelay: `${delay.toFixed(2)}s` } : undefined;
        return (
          <span key={i} className={wrapCls} style={style}>
            <Star id={`${uid}-${i}`} on={on} halo={withHalo && on} />
            {hero && animate && on && (
              <span className="star-sparks" aria-hidden="true">
                {SPARKS.map((s, k) => (
                  <i
                    key={k}
                    className={s.gold ? 'star-spark star-spark-gold' : 'star-spark'}
                    style={{ '--a': `${s.angle}deg`, '--l': `${s.length}px`, animationDelay: `${(delay + SPARK_LAG).toFixed(2)}s` } as CSSProperties}
                  />
                ))}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

interface StarProps {
  /** Unique id prefix for the gradient defs (one per rendered star). */
  id: string;
  on: boolean;
  halo?: boolean;
  className?: string;
}

/** One star glyph, self-contained (its gradients live inside). Used by Stars and by anything that needs a single star icon. */
export function Star({ id, on, halo = false, className }: StarProps) {
  const face = `${id}-f`;
  const glow = `${id}-h`;
  return (
    <svg className={['star', on ? 'star-on' : 'star-off', className].filter(Boolean).join(' ')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        {on ? (
          <linearGradient id={face} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff3a0" />
            <stop offset="0.45" stopColor="#ffd23f" />
            <stop offset="1" stopColor="#ff8a00" />
          </linearGradient>
        ) : (
          <linearGradient id={face} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3d4c" />
            <stop offset="0.45" stopColor="#23252f" />
            <stop offset="1" stopColor="#15161d" />
          </linearGradient>
        )}
        {halo && (
          <radialGradient id={glow}>
            <stop offset="0" stopColor="#ffd700" stopOpacity="0.5" />
            <stop offset="0.6" stopColor="#ffd700" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ffd700" stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      {halo && <circle className="star-halo" cx="12" cy="12.5" r="17" fill={`url(#${glow})`} />}
      <path
        className="star-body"
        d={STAR_PATH}
        fill={`url(#${face})`}
        stroke={on ? '#8a4500' : '#000'}
        strokeOpacity={on ? 1 : 0.6}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path className="star-facet" d={FACET_PATH} fill="#fff" opacity={on ? 0.55 : 0.06} />
    </svg>
  );
}
