import type { CSSProperties, ReactNode } from 'react';
import './panel.css';

interface Props {
  /** Makes the whole panel a button (the score panel opens «Подробнее»). */
  onPress?: () => void;
  /** Group caption as the first line: 11/700 caps, w55. */
  label?: ReactNode;
  /** 'score' = padding 24 16 16, content centred (score panel, dialogs); 'plain' = padding 16, content as given. */
  layout?: 'score' | 'plain';
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  /** The pressable panel toggles a section («Подробнее»). */
  'aria-expanded'?: boolean;
  children: ReactNode;
}

/** The 3D panel, radius 24: dark face, 1 px rim, 2 px light, 4 px underside, soft drop (spec §2.8). */
export function Panel({ onPress, label, layout = 'plain', className, style, children, ...rest }: Props) {
  const cls = ['panel', layout === 'score' && 'panel-score', onPress && 'panel-press', className].filter(Boolean).join(' ');
  const body = (
    <>
      {label !== undefined && <span className="panel-label">{label}</span>}
      {children}
    </>
  );
  if (onPress) {
    return (
      <button type="button" className={cls} style={style} aria-label={rest['aria-label']} aria-expanded={rest['aria-expanded']} onClick={onPress}>
        {body}
      </button>
    );
  }
  return (
    <div className={cls} style={style} aria-label={rest['aria-label']}>
      {body}
    </div>
  );
}
