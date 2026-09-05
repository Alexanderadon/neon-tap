/**
 * Service-worker registration + the update toast state (`public/sw.js`, filled by
 * scripts/build-sw.ts). The flow itself is the pure reducer in `updateState.ts`; this file only
 * wires browser events into it and runs its effects.
 */
import { createStore, useStore } from '@/shared/lib/store/createStore';
import { isUpdateAvailable, reduceSwUpdate, SW_INITIAL, type SwUpdateEvent, type SwUpdateState } from './updateState';

interface SwStoreState {
  updateAvailable: boolean;
  registered: boolean;
}

export const swStore = createStore<SwStoreState>({ updateAvailable: false, registered: false });

let state: SwUpdateState = SW_INITIAL;
let registration: ServiceWorkerRegistration | null = null;
let reloading = false;
/** Re-check for a new version this often while the app stays open (installed apps live for days). */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

function dispatch(event: SwUpdateEvent): void {
  const r = reduceSwUpdate(state, event);
  state = r.state;
  swStore.set({ updateAvailable: isUpdateAvailable(state) });
  if (r.effect === 'skip-waiting') registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  else if (r.effect === 'reload' && !reloading) {
    reloading = true;
    window.location.reload();
  }
}

function watchInstalling(reg: ServiceWorkerRegistration): void {
  const sw = reg.installing;
  if (!sw) return;
  sw.addEventListener('statechange', () => {
    if (sw.state === 'installed') dispatch({ type: 'installed', controlled: navigator.serviceWorker.controller !== null });
  });
}

/**
 * Register `/sw.js` (production builds only — dev has no precache list and Vite's HMR would
 * fight the cache). Idempotent; resolves to the registration or `null` when unsupported.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (registration) return registration;
  try {
    const hadController = () => navigator.serviceWorker.controller !== null;
    let controlledAtStart = hadController();
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      dispatch({ type: 'controllerchange', hadController: controlledAtStart });
      controlledAtStart = true;
    });
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    registration = reg;
    swStore.set({ registered: true });
    dispatch({ type: 'registered', waiting: reg.waiting !== null, controlled: hadController() });
    if (reg.installing) {
      dispatch({ type: 'updatefound' });
      watchInstalling(reg);
    }
    reg.addEventListener('updatefound', () => {
      dispatch({ type: 'updatefound' });
      watchInstalling(reg);
    });
    // Look for a new build when the app comes back to the foreground and once an hour.
    const check = () => void reg.update().catch(() => undefined);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check();
    });
    window.setInterval(check, UPDATE_CHECK_MS);
    return reg;
  } catch (err) {
    console.warn('[neon-tap] service worker registration failed', err);
    return null;
  }
}

/** Toast button: activate the waiting worker (then reload on controllerchange) or just reload. */
export function applyUpdate(): void {
  dispatch({ type: 'apply' });
}

export function useUpdateAvailable(): boolean {
  return useStore(swStore, (s) => s.updateAvailable);
}

/** Test seam: reset module state between cases. */
export function _resetSwState(): void {
  state = SW_INITIAL;
  registration = null;
  reloading = false;
  swStore.set({ updateAvailable: false, registered: false });
}
