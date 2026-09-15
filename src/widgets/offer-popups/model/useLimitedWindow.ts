import { useEffect, useState } from 'react';
import { limitedWindow, useOffers, type LimitedWindow } from '@/entities/offers';

/**
 * The 48-hour deal's window, re-evaluated every second while it is open (the countdown) and once
 * a minute otherwise. Null until the first launch is pinned; the clock restarts when it is (the
 * anchor may be pinned after this hook first read the time, so the time never precedes it).
 */
export function useLimitedWindow(): LimitedWindow | null {
  const anchor = useOffers((s) => s.anchor);
  const [now, setNow] = useState(() => Date.now());
  const w = anchor === null ? null : limitedWindow(anchor, Math.max(now, anchor));
  const active = w?.active ?? false;
  useEffect(() => {
    if (anchor === null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), active ? 1000 : 60_000);
    return () => window.clearInterval(id);
  }, [anchor, active]);
  return w;
}
