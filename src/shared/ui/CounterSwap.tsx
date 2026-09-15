import type { CSSProperties, ReactNode } from 'react';
import './chip.css';

interface Props {
  /** Value before the change. */
  from: ReactNode;
  /** Value after the change. */
  to: ReactNode;
  /** Run the tick (old up and out, new in from below). Off, or equal values: shows `to` only. */
  active?: boolean;
  /** Seconds before the tick. */
  delay?: number;
  className?: string;
}

/** A counter that "clicks" from one value to the next (the wallet chips after a run, prices after a purchase). */
export function CounterSwap({ from, to, active = false, delay, className }: Props) {
  const ticking = active && from !== to;
  if (!ticking) return <span className={['swap', className].filter(Boolean).join(' ')}>{to}</span>;
  const style: CSSProperties | undefined = delay !== undefined ? { animationDelay: `${delay}s` } : undefined;
  return (
    <span className={['swap', 'swap-active', className].filter(Boolean).join(' ')}>
      <span className="swap-old" style={style} aria-hidden="true">
        {from}
      </span>
      <span className="swap-new" style={style}>
        {to}
      </span>
    </span>
  );
}
