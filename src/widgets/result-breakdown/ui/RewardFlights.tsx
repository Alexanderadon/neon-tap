import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CrystalIcon, Stars } from '@/shared/ui';
import { T } from '../lib/timeline';

export interface FlightSource {
  kind: 'crystal' | 'star';
  count: number;
  from: RefObject<HTMLElement | null>;
}

export interface FlightTargets {
  crystal: RefObject<HTMLElement | null>;
  star: RefObject<HTMLElement | null>;
}

interface Props {
  sources: readonly FlightSource[];
  targets: FlightTargets;
  /** Seconds since the screen appeared, so delays stay on the shared timeline. */
  startedAt: number;
  /** Off once the screen is settled (the counters have already ticked). */
  enabled: boolean;
}

interface Path {
  key: string;
  kind: 'crystal' | 'star';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  delay: number;
}

const centre = (el: HTMLElement | null): { x: number; y: number } | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/**
 * The loot flies into the wallet: crystal and star icons on the topmost layer (a portal on `body`),
 * transform-only, from the coin centres to the chip centres. Measured right before the first flight,
 * so the paths are exact whatever the viewport.
 */
export function RewardFlights({ sources, targets, startedAt, enabled }: Props) {
  const [paths, setPaths] = useState<Path[] | null>(null);
  useEffect(() => {
    if (!enabled || sources.length === 0) return;
    const measureAt = Math.max(0, (T.FLY_CRYSTALS - 0.1) * 1000 - (performance.now() - startedAt));
    const timer = window.setTimeout(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const out: Path[] = [];
      let crystals = 0;
      let stars = 0;
      for (const s of sources) {
        const from = centre(s.from.current);
        const to = centre(s.kind === 'crystal' ? targets.crystal.current : targets.star.current);
        if (!from || !to) continue;
        for (let i = 0; i < s.count; i++) {
          const n = s.kind === 'crystal' ? crystals++ : stars++;
          const at = (s.kind === 'crystal' ? T.FLY_CRYSTALS : T.FLY_STARS) + n * T.FLY_STEP;
          out.push({ key: `${s.kind}-${n}`, kind: s.kind, x0: from.x, y0: from.y, x1: to.x, y1: to.y, delay: Math.max(0, at - elapsed) });
        }
      }
      setPaths(out);
    }, measureAt);
    return () => window.clearTimeout(timer);
  }, [sources, targets, startedAt, enabled]);
  if (!enabled || !paths || paths.length === 0 || typeof document === 'undefined') return null;
  return createPortal(
    <div className="reward-flights" aria-hidden="true">
      {paths.map((p) => (
        <span
          key={p.key}
          className={`reward-fly reward-fly-${p.kind}`}
          style={
            {
              '--x0': `${p.x0}px`,
              '--y0': `${p.y0}px`,
              '--xm': `${p.x0 + (p.x1 - p.x0) * 0.58}px`,
              '--ym': `${p.y0 + (p.y1 - p.y0) * 0.5}px`,
              '--x1': `${p.x1}px`,
              '--y1': `${p.y1}px`,
              animationDelay: `${p.delay.toFixed(2)}s`,
            } as CSSProperties
          }
        >
          {p.kind === 'crystal' ? <CrystalIcon size={20} halo /> : <Stars value={1} max={1} halo />}
        </span>
      ))}
    </div>,
    document.body,
  );
}
