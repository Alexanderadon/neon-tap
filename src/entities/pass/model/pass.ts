import { hasDevFlag } from '@/shared/config/devFlags';

/**
 * NEON PASS (docs/plans/subscription.md). Payments do not exist yet: the pass is active only with
 * the `?pass=1` review flag, so every PASS perk and gate can be seen before it can be bought. The
 * real entitlement (a signed token from our server) replaces this function, not its callers.
 */
export function isPassActive(): boolean {
  return hasDevFlag('pass');
}

/** The same for React: the value cannot change during a page load yet. */
export function usePassActive(): boolean {
  return isPassActive();
}
