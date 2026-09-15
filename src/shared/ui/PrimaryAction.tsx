import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './icons';
import './primary-action.css';

export type PrimaryTone = 'cyan' | 'locked' | 'danger';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Left 40 px slot: a `Disc` with an icon, a round cover thumbnail, or nothing. */
  lead?: ReactNode;
  /** First line, 20/700 caps («ИГРАТЬ», «ДАЛЬШЕ»). */
  label: ReactNode;
  /** Second line, 13/700 at 70 % (the track's name, «★ 22 из 25»). */
  sub?: ReactNode;
  /** Right 40 px slot, 24 px icon; defaults to the arrow, `null` hides it. */
  icon?: ReactNode | null;
  /** Breathing (translateY −2 px, transform only) — the one looping animation on a screen. */
  beat?: boolean;
  /** cyan = the action; locked = dark face, no beat (waiting / condition not met); danger = magenta («СБРОСИТЬ»). */
  tone?: PrimaryTone;
}

/** The 335 × 64 primary button: `40px 1fr 40px` grid, cyan 3D face, one construction on every screen (spec §2.12). */
export function PrimaryAction({ lead, label, sub, icon, beat = false, tone = 'cyan', className, type = 'button', ...rest }: Props) {
  const cls = ['primary', tone !== 'cyan' && `primary-${tone}`, beat && tone === 'cyan' && 'primary-beat', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      <span className="primary-lead">{lead}</span>
      <span className="primary-lbl">
        <b className="primary-label">{label}</b>
        {sub !== undefined && sub !== null && <small className="primary-sub">{sub}</small>}
      </span>
      <span className="primary-icon">{icon === undefined ? <Icon name="arrow" size={24} /> : icon}</span>
    </button>
  );
}

/** The 40 px black disc for the left slot (play triangle, lock, crystal, check …). */
export function Disc({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={['primary-disc', className].filter(Boolean).join(' ')}>{children}</span>;
}

/** The 40 px round thumbnail for the left slot (the next track's cover). */
export function Thumb({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={['primary-thumb', className].filter(Boolean).join(' ')}>{children}</span>;
}
