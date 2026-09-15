import type { CSSProperties, ReactNode, Ref } from 'react';
import './chip.css';

export type ChipVariant = 'cy' | 'gd' | 'dark' | 'white';

interface Props {
  /** cy = cyan number (crystals), gd = gold number (stars), dark = white number on the dark face, white = plain. */
  variant?: ChipVariant;
  /** 16 px icon in the left slot. */
  icon?: ReactNode;
  /** Fixed width (the wallet chips are 88 / 80 so the top bar never shifts with the digits). */
  width?: number;
  /** Icon only, no text (the pause chip). */
  iconOnly?: boolean;
  /** Renders a button when set. */
  onClick?: () => void;
  /** One scale bump (a counter just ticked). */
  bump?: boolean;
  /** Extra delay for the bump, seconds. */
  bumpDelay?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
  'aria-label'?: string;
  /** Position anchor for reward flights (TopBar passes it through). */
  chipRef?: Ref<HTMLElement>;
  children?: ReactNode;
}

/** 32 px pill with a dark 3D face: currency counters, difficulty, list places (spec §2.2). */
export function Chip({
  variant = 'white',
  icon,
  width,
  iconOnly = false,
  onClick,
  bump = false,
  bumpDelay,
  className,
  style,
  title,
  chipRef,
  children,
  ...rest
}: Props) {
  const cls = ['chip', variant !== 'white' && `chip-${variant}`, bump && 'chip-bump', onClick && 'chip-btn', iconOnly && 'chip-icon-only', className]
    .filter(Boolean)
    .join(' ');
  const merged: CSSProperties = { ...style };
  if (width !== undefined) merged.width = width;
  if (bumpDelay !== undefined) merged.animationDelay = `${bumpDelay}s`;
  const body = (
    <>
      {icon && <span className="chip-icon">{icon}</span>}
      {!iconOnly && <span className="chip-text">{children}</span>}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        style={merged}
        title={title}
        aria-label={rest['aria-label']}
        onClick={onClick}
        ref={chipRef as Ref<HTMLButtonElement>}
      >
        {body}
      </button>
    );
  }
  return (
    <span className={cls} style={merged} title={title} aria-label={rest['aria-label']} ref={chipRef as Ref<HTMLSpanElement>}>
      {body}
    </span>
  );
}
