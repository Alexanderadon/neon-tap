import { UNLOCK_ALL } from './constants';

/** Review and test switches taken from the page URL: `?auto=1` (the run plays itself), `?nofail=1`, `?unlock=1`, `?ads=fast`, `?iap=off`. */
const DEV_FLAGS = ['auto', 'nofail', 'unlock', 'ads', 'iap'] as const;

/**
 * The dev flags of this page load, read once. They are then removed from the address bar: they hold
 * for the session (every run in this tab), and a reload is a normal game — nobody ends up with the
 * autoplayer forever because a link once had `?auto=1` in it.
 */
const flags: Map<string, string> = readFlags();

function readFlags(): Map<string, string> {
  const found = new Map<string, string>();
  if (typeof window === 'undefined' || !window.location) return found;
  try {
    const url = new URL(window.location.href);
    for (const name of DEV_FLAGS) {
      const value = url.searchParams.get(name);
      if (value === null) continue;
      found.set(name, value);
      url.searchParams.delete(name);
    }
    if (found.size > 0 && typeof history !== 'undefined') history.replaceState(history.state, '', url.toString());
  } catch {
    // A page without a usable URL (tests, workers): no flags.
  }
  return found;
}

/** `?flag=1` was in the page URL when it loaded. Safe outside the browser (tests, workers). */
export function hasDevFlag(name: string): boolean {
  return flags.has(name);
}

/** The flag's value from the page URL (`?ads=fast` → 'fast'), or null. */
export function devFlagValue(name: string): string | null {
  return flags.get(name) ?? null;
}

/** Every track playable: the build-time `UNLOCK_ALL` switch or the `?unlock=1` dev override. */
export function unlockAllActive(): boolean {
  return UNLOCK_ALL || hasDevFlag('unlock');
}
