import { useCallback, useEffect, useState } from 'react';

/**
 * The result screen's "skip": any tap before the timeline ends jumps to the final state (`.is-settled`
 * on the root sets every animation to delay 0 / duration .01 s). Settles by itself after `totalSec`,
 * and at once for reduced-motion users.
 */
export function useSettled(totalSec: number): { settled: boolean; settle: () => void } {
  const [settled, setSettled] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const settle = useCallback(() => setSettled(true), []);
  useEffect(() => {
    if (settled) return;
    const t = window.setTimeout(settle, totalSec * 1000);
    return () => window.clearTimeout(t);
  }, [settled, settle, totalSec]);
  return { settled, settle };
}
