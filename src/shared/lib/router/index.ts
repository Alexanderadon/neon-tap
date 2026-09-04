import { createStore, useStore } from '@/shared/lib/store/createStore';

export type Screen = 'menu' | 'game' | 'result' | 'calibration' | 'settings' | 'custom';

interface RouterState {
  screen: Screen;
  /** Incremented on every navigation so page components remount (glitch transition). */
  key: number;
}

const router = createStore<RouterState>({ screen: 'menu', key: 0 });

export function navigate(screen: Screen): void {
  router.set((s) => ({ screen, key: s.key + 1 }));
}

export function useScreen(): Screen {
  return useStore(router, (s) => s.screen);
}

export function useRouteKey(): number {
  return useStore(router, (s) => s.key);
}
