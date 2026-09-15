import { createStore, useStore } from '@/shared/lib/store/createStore';

export type Screen = 'menu' | 'game' | 'result' | 'calibration' | 'settings' | 'custom' | 'tutorial' | 'shop' | 'welcome' | 'duel';

/** Intent for the target screen: which view to open (`records`, `profile`) or which track to focus (`track: id`). */
export type RouteParams = Readonly<Record<string, string>>;

interface RouterState {
  screen: Screen;
  params: RouteParams;
  /** Incremented on every navigation so page components remount (glitch transition). */
  key: number;
}

const NO_PARAMS: RouteParams = Object.freeze({});

const router = createStore<RouterState>({ screen: 'menu', params: NO_PARAMS, key: 0 });

export function navigate(screen: Screen, params: RouteParams = NO_PARAMS): void {
  router.set((s) => ({ screen, params, key: s.key + 1 }));
}

export function useScreen(): Screen {
  return useStore(router, (s) => s.screen);
}

/** The params of the current route (read once on mount — the page remounts per navigation). */
export function useRouteParams(): RouteParams {
  return useStore(router, (s) => s.params);
}

export function useRouteKey(): number {
  return useStore(router, (s) => s.key);
}
