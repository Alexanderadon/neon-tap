import { useState } from 'react';
import { dict } from '@/shared/i18n';
import { applyUpdate, useUpdateAvailable } from '@/shared/lib/pwa';
import { sfxUi } from '@/shared/lib/audio';
import './update-toast.css';

interface Props {
  /** Hidden while a song is playing: reloading mid-run would lose the attempt. */
  suppressed?: boolean;
}

/**
 * "Доступно обновление — обновить": shown when a new service worker waits (or another tab
 * activated one). The button sends SKIP_WAITING and the page reloads on `controllerchange`;
 * "Позже" hides it for this session — the next launch picks the new build up anyway.
 */
export function UpdateToast({ suppressed = false }: Props) {
  const available = useUpdateAvailable();
  const [snoozed, setSnoozed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!available || snoozed || suppressed) return null;
  return (
    <div className="update-toast" role="status" aria-live="polite">
      <svg className="update-toast-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M7.5 9.5 12 14l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 17.5v1a2.5 2.5 0 0 0 2.5 2.5h11a2.5 2.5 0 0 0 2.5-2.5v-1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <div className="update-toast-text">{dict.updateAvailable}</div>
      <button
        className="update-toast-btn"
        disabled={busy}
        onClick={() => {
          sfxUi();
          setBusy(true);
          applyUpdate();
        }}
      >
        {dict.updateNow}
      </button>
      <button className="update-toast-later" aria-label={dict.updateLater} onClick={() => setSnoozed(true)}>
        {dict.updateLater}
      </button>
    </div>
  );
}
