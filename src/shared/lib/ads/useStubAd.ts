import { useEffect, useState } from 'react';
import type { StubAds } from './stubAds';

/** How often a frame over the stub refreshes its ring and seconds. */
const TICK_MS = 100;

/** What a frame over the stub ad shows: the ring's progress (0..1), whole seconds left, and whether it still plays. */
export interface StubAdView {
  progress: number;
  left: number;
  playing: boolean;
}

function read(stub: StubAds): StubAdView {
  return { progress: stub.progress(), left: Math.ceil(stub.remainingSeconds()), playing: stub.playing };
}

/**
 * Follow the stub's ad while `active` — the shop's `AdScreen` and the second chance's waiting button
 * both draw its ring and seconds from here (a real network shows its own player instead).
 */
export function useStubAdProgress(stub: StubAds, active = true): StubAdView {
  const [view, setView] = useState(() => read(stub));
  useEffect(() => {
    if (!active) return;
    const update = () => setView(read(stub));
    update();
    const id = window.setInterval(update, TICK_MS);
    const off = stub.subscribe(update);
    return () => {
      window.clearInterval(id);
      off();
    };
  }, [stub, active]);
  return view;
}
