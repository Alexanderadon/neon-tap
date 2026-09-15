import { useEffect, type CSSProperties } from 'react';
import { CrystalIcon } from '@/shared/ui';

export interface FlightPath {
  /** Viewport coordinates of the start and the end (centres). */
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** Flight length and the stagger between the three crystals (mockup: .7 s, +.1 s each). */
export const FLIGHT_MS = 700;
export const FLIGHT_STEP_MS = 100;
const COUNT = 3;

interface Props {
  path: FlightPath;
  /** Called once the last crystal has landed (the wallet ticks then). */
  onDone: () => void;
}

/**
 * Three crystals flying along an arc into the wallet chip — the topmost layer, transform only
 * (spec §3: like the loot on the result screen). Rendered from the viewport, so it lands on the
 * chip whatever scrolls underneath.
 */
export function CrystalFlight({ path, onDone }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDone, FLIGHT_MS + FLIGHT_STEP_MS * (COUNT - 1) + 50);
    return () => window.clearTimeout(t);
  }, [onDone]);
  const mid = { x: (path.from.x + path.to.x) / 2, y: (path.from.y + path.to.y) / 2 - 24 };
  return (
    <div className="shop-flight" aria-hidden="true">
      {Array.from({ length: COUNT }, (_, i) => (
        <span
          key={i}
          className="shop-fly"
          style={
            {
              '--x0': `${path.from.x}px`,
              '--y0': `${path.from.y}px`,
              '--xm': `${mid.x}px`,
              '--ym': `${mid.y}px`,
              '--x1': `${path.to.x}px`,
              '--y1': `${path.to.y}px`,
              animationDelay: `${(i * FLIGHT_STEP_MS) / 1000}s`,
            } as CSSProperties
          }
        >
          <CrystalIcon size={20} />
        </span>
      ))}
    </div>
  );
}
