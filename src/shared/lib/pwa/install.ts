/**
 * Install prompt plumbing: capture `beforeinstallprompt` as early as possible (it fires once,
 * before React mounts), expose it as a store for the banner, remember "not now" in localStorage.
 * Platform / visibility rules are the pure functions in `platform.ts`.
 */
import { createStore, useStore } from '@/shared/lib/store/createStore';
import { INSTALL_DISMISSED_KEY, parseDismissedAt, serializeDismissedAt } from './dismissal';
import { detectInstallPlatform, type InstallPlatform } from './platform';
import { isStandaloneDisplay } from './standalone';

/** Chromium's non-standard event (not in lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** A `beforeinstallprompt` was captured and can be replayed. */
  canPrompt: boolean;
  /** `appinstalled` fired in this session — the banner goes away for good. */
  installed: boolean;
  /** Timestamp of the last "not now" (mirrors localStorage so the banner reacts without a reload). */
  dismissedAt: number | null;
}

export const installStore = createStore<InstallState>({ canPrompt: false, installed: false, dismissedAt: null });

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialised = false;

/** Call once from `main.tsx` before rendering; safe to call again. */
export function initInstallPrompt(): void {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;
  installStore.set({ dismissedAt: readInstallDismissedAt() });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // no mini-infobar: the in-app banner replays it
    deferredPrompt = e as BeforeInstallPromptEvent;
    installStore.set({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installStore.set({ canPrompt: false, installed: true });
  });
}

/** Replay the captured prompt. `unavailable` when nothing was captured (iOS, Firefox…). */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const ev = deferredPrompt;
  if (!ev) return 'unavailable';
  deferredPrompt = null;
  installStore.set({ canPrompt: false });
  try {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    return outcome;
  } catch {
    return 'unavailable';
  }
}

export function readInstallDismissedAt(): number | null {
  try {
    return parseDismissedAt(localStorage.getItem(INSTALL_DISMISSED_KEY));
  } catch {
    return null;
  }
}

/** "Not now": hide the banner for INSTALL_DISMISS_DAYS (see platform.ts). */
export function rememberInstallDismissed(now = Date.now()): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, serializeDismissedAt(now));
  } catch {
    /* private mode / quota — the banner simply returns next time */
  }
  installStore.set({ dismissedAt: now });
}

/** Platform of the current browser (the pure detector fed with navigator / media queries). */
export function getInstallPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'unsupported';
  let touch = false;
  try {
    touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    /* ignore */
  }
  return detectInstallPlatform({ ua: navigator.userAgent, standalone: isStandaloneDisplay(), touch });
}

export function useInstallState(): InstallState {
  return useStore(installStore, (s) => s);
}
