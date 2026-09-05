/**
 * Install-platform detection and the "show the install banner?" rule. Pure functions over the
 * user agent / display mode so they are testable; the DOM glue lives in the widgets.
 */

export type InstallPlatform =
  /** Already running from the home screen / as an installed app. */
  | 'standalone'
  /** iOS Safari: no prompt API, the user adds it via Share → Add to Home Screen. */
  | 'ios'
  /** Chrome / Samsung Internet etc.: `beforeinstallprompt` is expected. */
  | 'android'
  /** Desktop Chromium: `beforeinstallprompt` is expected. */
  | 'desktop'
  /** In-app browsers, iOS Chrome/Firefox, Firefox on Android… — no install path worth a banner. */
  | 'unsupported';

export interface PlatformInput {
  ua: string;
  /** `(display-mode: standalone)` or `navigator.standalone` (iOS). */
  standalone: boolean;
  /** `(pointer: coarse)` — separates iPadOS (desktop UA) from a Mac. */
  touch: boolean;
}

/** iPhone / iPad / iPod, including iPadOS 13+ which claims to be a Mac but has touch. */
export function isIos(ua: string, touch: boolean): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch);
}

/** Real Safari on iOS — the only iOS browser with Add to Home Screen the hint can rely on. */
export function isIosSafari(ua: string, touch: boolean): boolean {
  if (!isIos(ua, touch)) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|Brave|Instagram|FBAN|FBAV|Telegram|VK|Line\//i.test(ua)) return false;
  return /Safari/.test(ua);
}

export function isAndroid(ua: string): boolean {
  return /Android/.test(ua);
}

/** Embedded web views (Telegram, VK, Instagram, Facebook, Android WebView) can't install PWAs. */
export function isInAppBrowser(ua: string): boolean {
  return /\bwv\b|; wv\)|Instagram|FBAN|FBAV|Telegram|VKAndroidApp|VK\/|Line\//i.test(ua);
}

export function detectInstallPlatform({ ua, standalone, touch }: PlatformInput): InstallPlatform {
  if (standalone) return 'standalone';
  if (isInAppBrowser(ua)) return 'unsupported';
  if (isIos(ua, touch)) return isIosSafari(ua, touch) ? 'ios' : 'unsupported';
  if (isAndroid(ua)) return /Firefox|FxiOS/.test(ua) ? 'unsupported' : 'android';
  if (/Firefox|Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'unsupported';
  return 'desktop';
}

/** How long a dismissed banner stays hidden. */
export const INSTALL_DISMISS_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BannerInput {
  platform: InstallPlatform;
  /** A `beforeinstallprompt` event was captured (android / desktop only). */
  canPrompt: boolean;
  /** Timestamp of the last "not now", `null` if never dismissed. */
  dismissedAt: number | null;
  now: number;
}

/**
 * Show the banner when the platform has an install path, the app is not already installed and
 * the player has not said "not now" in the last INSTALL_DISMISS_DAYS days. On iOS the banner is a
 * hint (no prompt API); elsewhere it waits for the captured prompt so the button always works.
 */
export function shouldShowInstallBanner({ platform, canPrompt, dismissedAt, now }: BannerInput): boolean {
  if (platform === 'standalone' || platform === 'unsupported') return false;
  if (dismissedAt !== null && now - dismissedAt < INSTALL_DISMISS_DAYS * DAY_MS) return false;
  if (platform === 'ios') return true;
  return canPrompt;
}
