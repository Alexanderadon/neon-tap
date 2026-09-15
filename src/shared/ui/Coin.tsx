import type { CSSProperties, ReactNode } from 'react';
import './coin.css';

export type CoinTone = 'cy' | 'gd' | 'mag' | 'white';

interface Props {
  /** 20 px icon before the value (crystal, star). */
  icon?: ReactNode;
  /** 20/700 value («+35», «173»). */
  value: ReactNode;
  /** 13/400 grey caption («кристаллы», «за ранг S»). */
  caption: ReactNode;
  /** Colour of the value: cy = crystals, gd = stars, mag = not enough, white = neutral. */
  tone?: CoinTone;
  /** Drop in (translateY −12, scale .8 → 1); `delay` in seconds. */
  animate?: boolean;
  delay?: number;
  className?: string;
}

/** Reward / price coin 105 × 56, r 16: gold-tinted dark face, value row 24 + caption 16 (spec §2.9). */
export function Coin({ icon, value, caption, tone = 'white', animate = false, delay, className }: Props) {
  const cls = ['coin', animate && 'coin-drop', className].filter(Boolean).join(' ');
  const style: CSSProperties | undefined = delay !== undefined ? { animationDelay: `${delay}s` } : undefined;
  return (
    <span className={cls} style={style}>
      <b className={tone === 'white' ? 'coin-value' : `coin-value coin-${tone}`}>
        {icon && <span className="coin-icon">{icon}</span>}
        {value}
      </b>
      <small className="coin-caption">{caption}</small>
    </span>
  );
}
