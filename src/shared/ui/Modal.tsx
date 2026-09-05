import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import './ui.css';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Text of the close control (the dictionary is a layer above shared, so it is passed in). */
  closeLabel?: string;
  /** Bottom sheet on phones, side panel on wide screens (default) or a centred dialog. */
  variant?: 'sheet' | 'dialog';
  /** Element to focus on open instead of the first focusable one (e.g. a text field so the phone keyboard shows). */
  initialFocus?: RefObject<HTMLElement>;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Minimal accessible modal: role=dialog + aria-modal, labelled by its title, Escape and backdrop
 * close it, focus moves inside on open and returns to the opener on close, Tab wraps.
 */
export function Modal({ open, title, onClose, children, closeLabel = '×', variant = 'sheet', initialFocus }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    const first = initialFocus?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    // Capture phase so page-level hotkeys (R / Esc on the result screen) do not fire underneath.
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      const opener = openerRef.current;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open, onClose, initialFocus]);

  if (!open) return null;
  return (
    <div className={`modal-backdrop modal-${variant}`} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      {/* Keys typed inside the dialog must not reach page-level `window` hotkeys (e.g. "R" = retry
          on the result screen while a nickname is being typed). React dispatches this from the root's
          bubble listener, so handlers inside the panel still run first; only the bubble listeners
          above the root — i.e. on `window` (the page hotkeys) — are skipped. */}
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label={closeLabel}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
