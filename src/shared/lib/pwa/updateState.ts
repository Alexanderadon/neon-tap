/**
 * Service-worker update flow as a pure state machine (the DOM glue is in `serviceWorker.ts`).
 *
 *   registered(waiting)  ──▶ ready(apply)      a newer worker already waits → toast
 *   updatefound ──▶ installing ──▶ installed(controlled) ──▶ ready(apply)   → toast
 *   ready(apply) + apply ──▶ effect SKIP_WAITING, then controllerchange ──▶ effect reload
 *   controllerchange without our apply (another tab updated) ──▶ ready(reload) → toast, click reloads
 *   installed / controllerchange on the very first install (no controller before) ──▶ nothing
 */
export type SwPhase = 'idle' | 'installing' | 'ready';

export interface SwUpdateState {
  phase: SwPhase;
  /** What the toast button does: send SKIP_WAITING to the waiting worker, or just reload. */
  action: 'apply' | 'reload' | null;
  /** SKIP_WAITING was sent — the next controllerchange reloads the page. */
  applied: boolean;
}

export type SwUpdateEvent =
  | { type: 'registered'; waiting: boolean; controlled: boolean }
  | { type: 'updatefound' }
  | { type: 'installed'; controlled: boolean }
  | { type: 'apply' }
  | { type: 'controllerchange'; hadController: boolean };

export type SwEffect = 'skip-waiting' | 'reload' | null;

export const SW_INITIAL: SwUpdateState = { phase: 'idle', action: null, applied: false };

export function reduceSwUpdate(state: SwUpdateState, event: SwUpdateEvent): { state: SwUpdateState; effect: SwEffect } {
  switch (event.type) {
    case 'registered':
      if (event.waiting && event.controlled) return { state: { ...state, phase: 'ready', action: 'apply' }, effect: null };
      return { state, effect: null };
    case 'updatefound':
      // A worker installing while a toast is already up: keep the toast (the newest one wins on install).
      if (state.phase === 'ready') return { state, effect: null };
      return { state: { ...state, phase: 'installing' }, effect: null };
    case 'installed':
      // First install ever: the page was not controlled — nothing to announce.
      if (!event.controlled) return { state: { ...state, phase: 'idle' }, effect: null };
      return { state: { ...state, phase: 'ready', action: 'apply' }, effect: null };
    case 'apply':
      if (state.phase !== 'ready') return { state, effect: null };
      if (state.action === 'reload') return { state, effect: 'reload' };
      if (state.applied) return { state, effect: null };
      return { state: { ...state, applied: true }, effect: 'skip-waiting' };
    case 'controllerchange':
      if (!event.hadController) return { state, effect: null }; // clients.claim() on the first install
      if (state.applied) return { state, effect: 'reload' };
      // Someone else (another tab) activated a new worker under us: offer a reload.
      return { state: { ...state, phase: 'ready', action: 'reload' }, effect: null };
  }
}

/** The toast is visible while a new version can be applied or a reload is pending. */
export function isUpdateAvailable(state: SwUpdateState): boolean {
  return state.phase === 'ready' && state.action !== null;
}
