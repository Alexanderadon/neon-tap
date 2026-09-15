import { useEffect, type ReactNode } from 'react';
import './sheet.css';

interface Props {
  /** Id of the heading inside (`aria-labelledby`). */
  titleId?: string;
  /** A tap on the veil. */
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * The bottom sheet (spec §2.8, the shop's purchase sheet): a plain veil (no blur) and a panel
 * glued to the bottom edge, r 24 on top, one 335 column inside. The page behind stops scrolling
 * while it is up. Content, title and buttons are the caller's.
 */
export function Sheet({ titleId, onClose, className, children }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="sheet-root">
      <div className="sheet-dim" onPointerDown={onClose} />
      <div className={['sheet', className].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet-col">{children}</div>
      </div>
    </div>
  );
}
