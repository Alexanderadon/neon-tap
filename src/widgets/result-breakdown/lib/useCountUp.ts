import { useEffect, useRef, useState } from 'react';

/**
 * A number that runs up to `target` on screen: eased over `duration` ms after `delay` ms, on
 * requestAnimationFrame. Returns the value to show and whether the run is over (the "pop" moment).
 * Reduced-motion users get the final value at once.
 */
export function useCountUp(target: number, duration = 1200, delay = 200): { value: number; done: boolean } {
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target <= 0 || duration <= 0) {
      setValue(target);
      setDone(true);
      return;
    }
    setValue(0);
    setDone(false);
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const u = Math.min(1, Math.max(0, (now - t0) / duration));
      const eased = 1 - (1 - u) ** 3;
      setValue(Math.round(target * eased));
      if (u < 1) raf.current = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, delay]);
  return { value, done };
}
