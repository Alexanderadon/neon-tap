import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { dict } from '@/shared/i18n';
import { sfxUi } from '@/shared/lib/audio';
import { getInstallPlatform, promptInstall, rememberInstallDismissed, shouldShowInstallBanner, useInstallState } from '@/shared/lib/pwa';
import { Disc, Icon, Line, ObjButton, PrimaryAction } from '@/shared/ui';
import './install-banner.css';

/** The app mark 48 in the two system colours: gold / cyan lanes on the game's black, the white hit line. */
function MarkIcon() {
  return (
    <svg className="install-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="21" fill="#05060a" />
      <rect x="9" y="15" width="9.5" height="34" rx="3" fill="#ffd700" />
      <rect x="21" y="15" width="9.5" height="34" rx="3" fill="#00f0ff" />
      <rect x="33" y="15" width="9.5" height="34" rx="3" fill="#ffd700" />
      <rect x="45" y="15" width="9.5" height="34" rx="3" fill="#00f0ff" />
      <rect x="7" y="41" width="50" height="1.6" rx="0.8" fill="#fff" fillOpacity="0.85" />
    </svg>
  );
}

/** StepRow 48 (iOS): number in a 32 px circle · 20 px cyan icon · 15/700 text. Information, not a button. */
function StepRow({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="install-step">
      <span className="install-step-n" aria-hidden="true">
        {n}
      </span>
      <span className="install-step-icon">{icon}</span>
      <span className="install-step-text">{children}</span>
    </div>
  );
}

interface Props {
  /** Only the menu shows it — never over the play field. */
  active?: boolean;
}

/**
 * «Установить приложение» as a bottom sheet over a veil (screens-onboard C7): replays the captured
 * `beforeinstallprompt` on Chromium; on iOS Safari (no prompt API) shows the two steps Share →
 * Add to Home Screen. Hidden when running standalone, in unsupported browsers, and for 30 days
 * after «Не сейчас» (localStorage). A tap on the veil is «Не сейчас» too.
 */
export function InstallBanner({ active = true }: Props) {
  const { canPrompt, installed, dismissedAt } = useInstallState();
  const platform = useMemo(getInstallPlatform, []);
  const [busy, setBusy] = useState(false);
  // Delay the sheet a little so the first thing a new player sees is the game, not a prompt.
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
    <div className="install-dim" onPointerDown={(e) => e.target === e.currentTarget && dismiss()}>
      <div className="install-sheet" role="dialog" aria-modal="true" aria-label={dict.installTitle}>
        <MarkIcon />
        <h2 className="install-title">{dict.installTitle}</h2>
        <Line className="install-line">{platform === 'ios' ? dict.installIosShort : dict.installShort}</Line>
        {platform === 'ios' ? (
          <>
            <StepRow n={1} icon={<Icon name="share" />}>
              {dict.installIosShare}
            </StepRow>
            <StepRow n={2} icon={<Icon name="plus-square" />}>
              {dict.installIosHome}
            </StepRow>
          </>
        ) : (
          <PrimaryAction
            className="install-primary"
            lead={
              <Disc>
                <Icon name="plus-square" />
              </Disc>
            }
            label={dict.installButton}
            sub={dict.installHome}
            beat={!busy}
            disabled={busy}
            onClick={() => void install()}
          />
        )}
        <ObjButton className="install-later" icon={<Icon name="cross" />} label={dict.installNotNow} onClick={dismiss} />
      </div>
    </div>
  );
}
