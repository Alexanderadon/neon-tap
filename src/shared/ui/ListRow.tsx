import type { ReactNode } from 'react';
import './list-row.css';

interface RowProps {
  /** Left slot: a `PlaceChip`, an `Avatar` 32, a round cover. */
  lead?: ReactNode;
  /** The name (15/700, ellipsis). */
  name: ReactNode;
  /** The score in w80 (thin-space thousands). */
  score?: ReactNode;
  /** Right slot after the score: a Tag («ПОБИЛ», «ПОЗАДИ»). */
  end?: ReactNode;
  /** My row: cyan rim and a cyan name. */
  me?: boolean;
  /** `li` inside an `ol` (records), `div` elsewhere. */
  as?: 'li' | 'div';
  className?: string;
}

/** ListRow 335 × 48, r 16: the panel material without an underside (not a button) — lead · name · score · end. */
export function ListRow({ lead, name, score, end, me = false, as = 'li', className }: RowProps) {
  const cls = ['lrow', me && 'lrow-me', className].filter(Boolean).join(' ');
  const body = (
    <>
      {lead}
      <span className="lrow-name">{name}</span>
      {score !== undefined && <span className="lrow-score">{score}</span>}
      {end}
    </>
  );
  return as === 'li' ? (
    <li className={cls} aria-current={me ? 'true' : undefined}>
      {body}
    </li>
  ) : (
    <div className={cls} aria-current={me ? 'true' : undefined}>
      {body}
    </div>
  );
}

/** The place in a list row: a 32 px chip fixed at 40 wide; 1–3 in gold. */
export function PlaceChip({ place }: { place: number }) {
  return <span className={place <= 3 ? 'lrow-pos lrow-pos-top' : 'lrow-pos'}>{place}</span>;
}

interface StateProps {
  /** A 32 px icon or `SegmentsPulse` (loading). */
  icon: ReactNode;
  role?: 'status' | 'alert';
  /** Extra content under the line (a «Повторить» button). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** State panel 335 × 112, r 24: an icon 32 (or pulsing segments) over one 13 px grey line — loading, offline, empty. */
export function StatePanel({ icon, role = 'status', action, className, children }: StateProps) {
  return (
    <div className={['spanel', className].filter(Boolean).join(' ')} role={role}>
      <span className="spanel-icon">{icon}</span>
      <span className="spanel-text">{children}</span>
      {action}
    </div>
  );
}
