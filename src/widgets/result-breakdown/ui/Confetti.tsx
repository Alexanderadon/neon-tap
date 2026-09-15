import type { CSSProperties } from 'react';
import { T } from '../lib/timeline';

const COUNT = 16;

/** Deterministic scatter (a tiny LCG) so the burst looks the same on every run and in tests. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const PIECES = (() => {
  const r = lcg(7);
  return Array.from({ length: COUNT }, (_, i) => ({
    left: 8 + Math.round(r() * 84), // % of the hero width
    top: 16 + Math.round(r() * 100), // px from the hero top (the hero is 144 tall)
    gold: i % 3 !== 1,
    gem: i % 3 === 0,
    duration: 1.5 + Math.round(r() * 60) / 100,
    delay: T.CONFETTI_FROM + Math.round(r() * (T.CONFETTI_TO - T.CONFETTI_FROM) * 100) / 100,
    rotate: Math.round(r() * 360),
  }));
})();

/** Sixteen gold / white pieces falling 120 px over the stars, once (spec §2.14). */
export function Confetti() {
  return (
    <span className="result-confetti" aria-hidden="true">
      {PIECES.map((p, i) => (
        <i
          key={i}
          className={p.gem ? 'result-cf result-cf-gem' : 'result-cf'}
          style={
            {
              left: `${p.left}%`,
              top: `${p.top}px`,
              background: p.gold ? 'var(--gold)' : '#fff',
              '--cf-d': `${p.duration}s`,
              '--cf-r': `${p.rotate}deg`,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
