import { describe, expect, it } from 'vitest';
import { detectInstallPlatform, INSTALL_DISMISS_DAYS, isInAppBrowser, isIos, isIosSafari, shouldShowInstallBanner } from './platform';

const UA = {
  iosSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iosChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.87 Mobile/15E148 Safari/604.1',
  iosFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15',
  ipadOs: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.80 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.6312.80 Mobile Safari/537.36',
  telegram: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36 Telegram-Android/10.9.1',
  winChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.2420.65',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
};

describe('isIos / isIosSafari', () => {
  it('recognises iPhones and iPadOS (Mac UA + touch)', () => {
    expect(isIos(UA.iosSafari, true)).toBe(true);
    expect(isIos(UA.ipadOs, true)).toBe(true);
    expect(isIos(UA.macSafari, false)).toBe(false);
    expect(isIos(UA.androidChrome, true)).toBe(false);
  });

  it('only Safari itself gets the Share → Home Screen hint', () => {
    expect(isIosSafari(UA.iosSafari, true)).toBe(true);
    expect(isIosSafari(UA.ipadOs, true)).toBe(true);
    expect(isIosSafari(UA.iosChrome, true)).toBe(false);
    expect(isIosSafari(UA.iosFirefox, true)).toBe(false);
  });
});

describe('detectInstallPlatform', () => {
  const p = (ua: string, touch = true, standalone = false) => detectInstallPlatform({ ua, touch, standalone });

  it('standalone wins over everything', () => {
    expect(p(UA.iosSafari, true, true)).toBe('standalone');
    expect(p(UA.androidChrome, true, true)).toBe('standalone');
    expect(p(UA.winChrome, false, true)).toBe('standalone');
  });

  it('iOS: Safari → ios, other browsers → unsupported', () => {
    expect(p(UA.iosSafari)).toBe('ios');
    expect(p(UA.ipadOs)).toBe('ios');
    expect(p(UA.iosChrome)).toBe('unsupported');
    expect(p(UA.iosFirefox)).toBe('unsupported');
  });

  it('Android: Chromium browsers → android, Firefox / web views → unsupported', () => {
    expect(p(UA.androidChrome)).toBe('android');
    expect(p(UA.samsung)).toBe('android');
    expect(p(UA.androidFirefox)).toBe('unsupported');
    expect(p(UA.androidWebView)).toBe('unsupported');
    expect(p(UA.telegram)).toBe('unsupported');
    expect(isInAppBrowser(UA.telegram)).toBe(true);
    expect(isInAppBrowser(UA.androidChrome)).toBe(false);
  });

  it('desktop: Chromium → desktop, Safari / Firefox → unsupported', () => {
    expect(p(UA.winChrome, false)).toBe('desktop');
    expect(p(UA.winEdge, false)).toBe('desktop');
    expect(p(UA.winFirefox, false)).toBe('unsupported');
    expect(p(UA.macSafari, false)).toBe('unsupported');
  });
});

describe('shouldShowInstallBanner', () => {
  const now = 1_800_000_000_000;
  const day = 24 * 60 * 60 * 1000;

  it('never in standalone or on unsupported platforms', () => {
    expect(shouldShowInstallBanner({ platform: 'standalone', canPrompt: true, dismissedAt: null, now })).toBe(false);
    expect(shouldShowInstallBanner({ platform: 'unsupported', canPrompt: true, dismissedAt: null, now })).toBe(false);
  });

  it('iOS shows the hint without a prompt; android/desktop wait for beforeinstallprompt', () => {
    expect(shouldShowInstallBanner({ platform: 'ios', canPrompt: false, dismissedAt: null, now })).toBe(true);
    expect(shouldShowInstallBanner({ platform: 'android', canPrompt: false, dismissedAt: null, now })).toBe(false);
    expect(shouldShowInstallBanner({ platform: 'android', canPrompt: true, dismissedAt: null, now })).toBe(true);
    expect(shouldShowInstallBanner({ platform: 'desktop', canPrompt: true, dismissedAt: null, now })).toBe(true);
  });

  it('a dismissal hides the banner for INSTALL_DISMISS_DAYS, then it comes back', () => {
    expect(shouldShowInstallBanner({ platform: 'ios', canPrompt: false, dismissedAt: now - day, now })).toBe(false);
    expect(shouldShowInstallBanner({ platform: 'android', canPrompt: true, dismissedAt: now - (INSTALL_DISMISS_DAYS - 1) * day, now })).toBe(false);
    expect(shouldShowInstallBanner({ platform: 'android', canPrompt: true, dismissedAt: now - (INSTALL_DISMISS_DAYS + 1) * day, now })).toBe(true);
    // A clock set into the past (dismissedAt in the future) still counts as recent.
    expect(shouldShowInstallBanner({ platform: 'ios', canPrompt: false, dismissedAt: now + day, now })).toBe(false);
  });
});
