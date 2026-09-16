import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
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
  /** The track's accent (`#rrggbb`): the cyan face, underside and glow take this colour — the button wears the song it starts. */
  tint?: string;
}

/** `#rrggbb` → the underside (a darker shade), the glow (the colour at 25 %) and the text colour of a tinted face. */
function tintVars(hex: string): CSSProperties {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Dark text on a light tint, white on a dark one (the cyan face keeps its dark text).
  const light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
  return {
    '--pa-tint': hex,
    '--pa-text': light ? 'var(--bg)' : '#fff',
    '--pa-under': `rgb(${Math.round(r * 0.4)}, ${Math.round(g * 0.4)}, ${Math.round(b * 0.4)})`,
    '--pa-glow': `rgba(${r}, ${g}, ${b}, 0.25)`,
  } as CSSProperties;
}

/** The 335 × 64 primary button: `40px 1fr 40px` grid, cyan 3D face, one construction on every screen (spec §2.12). The ref is the button (flights measure it). */
export const PrimaryAction = forwardRef<HTMLButtonElement, Props>(function PrimaryAction(
  { lead, label, sub, icon, beat = false, tone = 'cyan', tint, className, type = 'button', style, ...rest },
  ref,
) {
  const tinted = tone === 'cyan' && !!tint;
  const cls = ['primary', tone !== 'cyan' && `primary-${tone}`, beat && tone === 'cyan' && 'primary-beat', tinted && 'primary-tinted', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={cls} style={tinted ? { ...tintVars(tint), ...style } : style} {...rest}>
      <span className="primary-lead">{lead}</span>
      <span className="primary-lbl">
        <b className="primary-label">{label}</b>
        {sub !== undefined && sub !== null && <small className="primary-sub">{sub}</small>}
      </span>
      <span className="primary-icon">{icon === undefined ? <Icon name="arrow" size={24} /> : icon}</span>
    </button>
  );
});

/** The 40 px black disc for the left slot (play triangle, lock, crystal, check …). */
export function Disc({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={['primary-disc', className].filter(Boolean).join(' ')}>{children}</span>;
}

/** The 40 px round thumbnail for the left slot (the next track's cover). */
export function Thumb({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={['primary-thumb', className].filter(Boolean).join(' ')}>{children}</span>;
}
