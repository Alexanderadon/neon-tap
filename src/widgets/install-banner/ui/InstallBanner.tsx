import { useEffect, useMemo, useState } from 'react';
import { dict } from '@/shared/i18n';
import { sfxUi } from '@/shared/lib/audio';
import { getInstallPlatform, promptInstall, rememberInstallDismissed, shouldShowInstallBanner, useInstallState } from '@/shared/lib/pwa';
import './install-banner.css';

/** The app mark: four neon lanes and the hit line, same design as public/icons/icon.svg. */
function MarkIcon() {
  return (
    <svg className="install-banner-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#05060a" />
      <rect x="9" y="15" width="9.5" height="34" rx="3" fill="#00f0ff" />
      <rect x="21" y="15" width="9.5" height="34" rx="3" fill="#ff2bd6" />
      <rect x="33" y="15" width="9.5" height="34" rx="3" fill="#b6ff00" />
      <rect x="45" y="15" width="9.5" height="34" rx="3" fill="#ff8a00" />
      <rect x="7" y="41" width="50" height="1.6" rx="0.8" fill="#fff" fillOpacity="0.85" />
    </svg>
  );
}

/** iOS "Share" glyph (box with an arrow up). */
function ShareIcon() {
  return (
    <svg className="install-banner-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m8 7 4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** iOS "Add to Home Screen" glyph (square with a plus). */
function HomeIcon() {
  return (
    <svg className="install-banner-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8.5v7M8.5 12h7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  /** Only the menu shows it — never over the play field. */
  active?: boolean;
}

/**
 * "Установить приложение": replays the captured `beforeinstallprompt` on Chromium; on iOS Safari
 * (no prompt API) explains Share → Add to Home Screen. Hidden when running standalone, in
 * unsupported browsers, and for 30 days after "Не сейчас" (localStorage).
 */
export function InstallBanner({ active = true }: Props) {
  const { canPrompt, installed, dismissedAt } = useInstallState();
  const platform = useMemo(getInstallPlatform, []);
  const [busy, setBusy] = useState(false);
  // Delay the banner a little so the first thing a new player sees is the game, not a prompt.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  if (!active || !settled || installed) return null;
  if (!shouldShowInstallBanner({ platform, canPrompt, dismissedAt, now: Date.now() })) return null;

  const dismiss = () => {
    sfxUi();
    rememberInstallDismissed();
  };
  const install = async () => {
    sfxUi();
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    if (outcome === 'dismissed') rememberInstallDismissed();
  };

  return (
    <div className="install-banner" role="dialog" aria-label={dict.installTitle}>
      <MarkIcon />
      <div className="install-banner-body">
        <div className="install-banner-title">{dict.installTitle}</div>
        {platform === 'ios' ? (
          <div className="install-banner-hint install-banner-ios">
            <span>{dict.installIosHint}</span>
            <span className="install-banner-steps">
              <ShareIcon />
              <span>{dict.installIosShare}</span>
              <span className="install-banner-arrow" aria-hidden="true">
                →
              </span>
              <HomeIcon />
              <span>{dict.installIosHome}</span>
            </span>
          </div>
        ) : (
          <div className="install-banner-hint">{dict.installHint}</div>
        )}
        <div className="install-banner-actions">
          {platform !== 'ios' && (
            <button className="install-banner-btn" disabled={busy} onClick={() => void install()}>
              {dict.installButton}
            </button>
          )}
          <button className="install-banner-later" onClick={dismiss}>
            {dict.installNotNow}
          </button>
        </div>
      </div>
      <button className="install-banner-close" aria-label={dict.installClose} onClick={dismiss}>
        <CloseIcon />
      </button>
    </div>
  );
}
