/**
 * The app is sized to the visible viewport, not the layout one. An in-app browser (the iOS Safari
 * view with its floating toolbar), a mobile toolbar or the Android keyboard can cover the bottom of
 * a `100dvh` / `inset: 0` page — and every screen keeps its primary button there. `visualViewport`
 * reports the part actually on screen: its top and height go to `--app-top` / `--app-h` on <html>,
 * and #root, the containing block of every fixed layer (global.css), follows them.
 */

export interface ViewportBox {
  top: number;
  height: number;
}

interface VisualViewportLike {
  offsetTop: number;
  height: number;
  scale: number;
}

interface FocusedLike {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
}

/** Inputs that never raise a keyboard. */
const NO_KEYBOARD = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);

/** True while the focused element takes typing (the keyboard is, or is about to be, up). */
export function isTextField(el: FocusedLike | null | undefined): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toUpperCase();
  return tag === 'TEXTAREA' || (tag === 'INPUT' && !NO_KEYBOARD.has((el.type ?? 'text').toLowerCase()));
}

/**
 * The box to size the app to, or null to keep the current one: while typing (the keyboard pans the
 * page on iOS — chasing it would shove the field away) and while pinch-zoomed (the zoom is not a
 * smaller screen). Without `visualViewport` the window's inner height stands in.
 */
export function visibleBox(vv: VisualViewportLike | null | undefined, innerHeight: number, typing: boolean): ViewportBox | null {
  if (typing) return null;
  if (!vv) return innerHeight > 0 ? { top: 0, height: Math.round(innerHeight) } : null;
  if (Math.abs(vv.scale - 1) > 0.01 || vv.height <= 0) return null;
  return { top: Math.max(0, Math.round(vv.offsetTop)), height: Math.round(vv.height) };
}

/** Keeps `--app-top` / `--app-h` on <html> equal to the visible viewport; returns the uninstaller. */
export function installAppViewport(win: Window = window): () => void {
  const root = win.document.documentElement;
  const vv = win.visualViewport;
  let last = '';
  const apply = () => {
    const box = visibleBox(vv, win.innerHeight, isTextField(win.document.activeElement as FocusedLike | null));
    if (!box || `${box.top}/${box.height}` === last) return;
    last = `${box.top}/${box.height}`;
    root.style.setProperty('--app-top', `${box.top}px`);
    root.style.setProperty('--app-h', `${box.height}px`);
  };
  // iOS reports a rotation (and a closing keyboard) a beat late, and focus may only be passing to the next field: measure once it has settled.
  const settle = () => win.setTimeout(apply, 350);
  apply();
  vv?.addEventListener('resize', apply);
  vv?.addEventListener('scroll', apply);
  win.addEventListener('resize', apply);
  win.addEventListener('orientationchange', settle);
  win.addEventListener('focusout', settle);
  return () => {
    vv?.removeEventListener('resize', apply);
    vv?.removeEventListener('scroll', apply);
    win.removeEventListener('resize', apply);
    win.removeEventListener('orientationchange', settle);
    win.removeEventListener('focusout', settle);
  };
}
