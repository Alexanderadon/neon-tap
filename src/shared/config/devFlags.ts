import { UNLOCK_ALL } from './constants';

/** `?flag=1` in the page URL. Safe outside the browser (tests, workers). */
export function hasDevFlag(name: string): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    return new URLSearchParams(window.location.search).has(name);
  } catch {
    return false;
  }
}

/** Every track playable: the build-time `UNLOCK_ALL` switch or the `?unlock=1` dev override. */
export function unlockAllActive(): boolean {
  return UNLOCK_ALL || hasDevFlag('unlock');
}
