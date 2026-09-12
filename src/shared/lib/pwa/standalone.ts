/**
 * Installed-app ("standalone") polish: no pinch / keyboard / wheel zoom and no browser gestures
 * that a full-screen game must never trigger. Pure decision helpers first (tested), DOM glue below.
 */

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Ctrl/Cmd + (plus | minus | equals | 0) — browser zoom shortcuts, also on the numpad. */
export function isZoomShortcut(e: KeyLike): boolean {
  if (!e.ctrlKey && !e.metaKey) return false;
  return e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0' || e.key === 'Add' || e.key === 'Subtract';
}

/** Ctrl + wheel (and pinch on trackpads, which browsers report as ctrl+wheel) zooms the page. */
export function isZoomWheel(e: { ctrlKey: boolean }): boolean {
  return e.ctrlKey;
}

/** Two or more fingers on the page: pinch-zoom (iOS ignores `user-scalable=no`). */
export function isMultiTouch(touches: number): boolean {
  return touches > 1;
}

/** `(display-mode: standalone | fullscreen | minimal-ui)` or iOS `navigator.standalone`. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof matchMedia === 'function') {
      if (matchMedia('(display-mode: standalone)').matches) return true;
      if (matchMedia('(display-mode: fullscreen)').matches) return true;
      if (matchMedia('(display-mode: minimal-ui)').matches) return true;
    }
  } catch {
    /* jsdom / old browsers */
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

let guardsInstalled = false;

/**
 * Register the guards once. Only when running standalone: in a browser tab the user keeps the
 * usual zoom and gestures (the game itself already blocks them while playing — game-canvas).
 * Returns a disposer (used by tests / hot reload).
 */
export function installStandaloneGuards(force = false): () => void {
  if (guardsInstalled || typeof document === 'undefined') return () => undefined;
  if (!force && !isStandaloneDisplay()) return () => undefined;
  guardsInstalled = true;
  const prevent = (e: Event) => e.preventDefault();
  const onKey = (e: KeyboardEvent) => {
    if (isZoomShortcut(e)) e.preventDefault();
  };
  const onWheel = (e: WheelEvent) => {
    if (isZoomWheel(e)) e.preventDefault();
  };
  const onTouch = (e: TouchEvent) => {
    if (isMultiTouch(e.touches.length)) e.preventDefault();
  };
  const opts: AddEventListenerOptions = { passive: false, capture: true };
  window.addEventListener('keydown', onKey, opts);
  window.addEventListener('wheel', onWheel, opts);
  document.addEventListener('touchstart', onTouch, opts);
  document.addEventListener('touchmove', onTouch, opts);
  // iOS Safari pinch / rotate gestures.
  document.addEventListener('gesturestart', prevent, opts);
  document.addEventListener('gesturechange', prevent, opts);
  // Long-press context menu on the canvas / touch zones.
  document.addEventListener('contextmenu', prevent, opts);
  document.documentElement.classList.add('standalone');
  return () => {
    guardsInstalled = false;
    window.removeEventListener('keydown', onKey, opts);
    window.removeEventListener('wheel', onWheel, opts);
    document.removeEventListener('touchstart', onTouch, opts);
    document.removeEventListener('touchmove', onTouch, opts);
    document.removeEventListener('gesturestart', prevent, opts);
    document.removeEventListener('gesturechange', prevent, opts);
    document.removeEventListener('contextmenu', prevent, opts);
    document.documentElement.classList.remove('standalone');
  };
}
