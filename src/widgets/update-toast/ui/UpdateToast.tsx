import { useEffect, useRef, useState } from 'react';
import { dict } from '@/shared/i18n';
import { applyUpdate, useUpdateAvailable } from '@/shared/lib/pwa';
import { sfxUi } from '@/shared/lib/audio';
import { Chip, Icon } from '@/shared/ui';
import './update-toast.css';

interface Props {
  /** Hidden while a song is playing: reloading mid-run would lose the attempt. */
  suppressed?: boolean;
}

/** The toast hides itself after this long (screens-onboard C8: «Позже» = a swipe up or six seconds). */
const AUTO_HIDE_MS = 6000;
/** A swipe up of at least this many px dismisses it. */
const SWIPE_PX = 24;

/**
 * «Есть обновление · Обновить» (screens-onboard C8): a 48 px toast that drops in under the top
 * bar — over the sub-header, never over the play / shop row. The chip sends SKIP_WAITING and the
 * page reloads on `controllerchange`; a swipe up or six seconds hide it for this session — the
 * next launch picks the new build up anyway.
 */
export function UpdateToast({ suppressed = false }: Props) {
  const available = useUpdateAvailable();
  const [snoozed, setSnoozed] = useState(false);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);
  const visible = available && !snoozed && !suppressed;

  useEffect(() => {
    if (!visible || busy) return;
    const t = window.setTimeout(() => setSnoozed(true), AUTO_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [visible, busy]);

  if (!visible) return null;
  return (
    <div
      className="utoast"
      role="status"
      aria-live="polite"
      onPointerDown={(e) => {
        startY.current = e.clientY;
      }}
      onPointerMove={(e) => {
        if (startY.current !== null && startY.current - e.clientY > SWIPE_PX) {
          startY.current = null;
          setSnoozed(true);
        }
      }}
      onPointerUp={() => {
        startY.current = null;
      }}
      onPointerCancel={() => {
        startY.current = null;
      }}
    >
      <span className="utoast-icon">
        <Icon name="tray" size={20} />
      </span>
      <span className="utoast-text">{dict.updateShort}</span>
      <Chip
        variant="cy"
        onClick={() => {
          if (busy) return;
          sfxUi();
          setBusy(true);
          applyUpdate();
        }}
        aria-label={dict.updateNow}
      >
        {dict.updateNow}
      </Chip>
    </div>
  );
}
