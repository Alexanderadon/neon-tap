import type { CSSProperties, ReactNode } from 'react';
import './hero.css';

interface HeadlineProps {
  /** `h1` on a page, `h2` inside a frame or dialog, `div` for a status line. */
  as?: 'h1' | 'h2' | 'div';
  /** Magenta material («ПРОВАЛ», «ПОВЕРНИ ТЕЛЕФОН» is white). */
  tone?: 'gold' | 'mag';
  /** Overshoot pop on mount (`vpop`). */
  pop?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Headline 28/900 caps in the verdict material (`--emboss`, text-shadow only): «КАК ТЕБЯ ЗОВУТ?», «ГОТОВО», «ВКЛЮЧИТЬ ЗВУК». */
export function Headline({ as = 'h1', tone = 'gold', pop = false, id, className, style, children }: HeadlineProps) {
  const cls = ['headline', tone === 'mag' && 'headline-mag', pop && 'headline-pop', className].filter(Boolean).join(' ');
  const Tag = as;
  return (
    <Tag id={id} className={cls} style={style}>
      {children}
    </Tag>
  );
}

interface DiscProps {
  /** cyan = the primary button's face (action); dark = the illustration variant (a 48 px icon, no inner disc). */
  tone?: 'cyan' | 'dark';
  /** Breathing (transform only) — the audio gate's tap target. */
  beat?: boolean;
  /** Makes the disc a button. */
  onClick?: () => void;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** BigDisc 96: the primary's face and 4 px underside around a black 56 px disc with a 32 px icon (the onboarding hero). */
export function BigDisc({ tone = 'cyan', beat = false, onClick, className, style, children, ...rest }: DiscProps) {
  const cls = ['bigdisc', tone === 'dark' && 'bigdisc-dark', beat && 'bigdisc-beat', className].filter(Boolean).join(' ');
  const body = tone === 'dark' ? children : <span className="bigdisc-in">{children}</span>;
  if (onClick) {
    return (
      <button type="button" className={cls} style={style} onClick={onClick} aria-label={rest['aria-label']}>
        {body}
      </button>
    );
  }
  return (
    <span className={cls} style={style} aria-hidden="true">
      {body}
    </span>
  );
}
