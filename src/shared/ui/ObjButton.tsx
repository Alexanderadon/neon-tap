import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './obj-button.css';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** 20 px stroke icon. */
  icon: ReactNode;
  /** Caption: 11/700 caps in the 105 × 48 cell, 15/700 in the wide row. */
  label: ReactNode;
  /** Magenta 16 px badge in the top-right corner (the shop's "new affordable" count). */
  badge?: number | string;
  /** Selected variant in a row of three (cyan face, like the primary button). */
  active?: boolean;
  /** 335 × 48 horizontal row: icon · label · `end` slot (a Chip, a Tag or a chevron). */
  wide?: boolean;
  /** Right slot of the wide row. */
  end?: ReactNode;
  /** Magenta caption («Сброс») — the only magenta text allowed on a button. */
  danger?: boolean;
  /** The primary button's construction (`40px 1fr 40px`): icon · two centred lines (label 15/700 + `sub` 13/700) · `end`. */
  construction?: boolean;
  /** Second centred line of the construction variant. */
  sub?: ReactNode;
}

/** Object button 105 × 48 (rows of three) or 335 × 48 (wide): dark 3D face, 2 px light, 4 px underside (spec §2.11). */
export const ObjButton = forwardRef<HTMLButtonElement, Props>(function ObjButton(
  { icon, label, badge, active = false, wide = false, end, danger = false, construction = false, sub, className, type = 'button', ...rest }: Props,
  ref,
) {
  const row = wide || construction;
  const cls = ['obj', row && 'obj-wide', construction && 'obj-cons', active && 'obj-on', danger && 'obj-danger', className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={cls} {...rest}>
      <span className="obj-icon">{icon}</span>
      <span className="obj-label">
        {construction ? <b className="obj-title">{label}</b> : label}
        {construction && sub !== undefined && <small className="obj-sub">{sub}</small>}
      </span>
      {row && end !== undefined && <span className="obj-end">{end}</span>}
      {badge !== undefined && badge !== 0 && badge !== '' && <i className="obj-badge">{badge}</i>}
    </button>
  );
});
