import { useId } from 'react';

/*
 * Procedural hero placeholders, 335 × 180, drawn in the neon palette (the exact hexes of the
 * design system). Everything is plain SVG paint — gradients, strokes, opacity — no CSS filter.
 * They stand in until `public/offers/<name>.webp` exists.
 */

const CYAN = '#00f0ff';
const GOLD = '#ffd700';
const PANEL = '#0b0d16';

/** One crystal in the icon's silhouette (24-unit box), placed by translate / scale. */
function Gem({ x, y, s, color = CYAN, rot = 0 }: { x: number; y: number; s: number; color?: string; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-12 -12)`}>
      <path d="M12 2 L20 9 L12 22 L4 9 Z" fill={color} opacity="0.92" />
      <path d="M12 2 L20 9 L12 22 Z" fill="#fff" opacity="0.22" />
      <path d="M4 9 L20 9 L12 22 Z" fill="#000" opacity="0.2" />
      <path d="M8 9 L12 2 L16 9" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.7" strokeLinejoin="round" />
    </g>
  );
}

/** The dark ground with a faint neon horizon — the scene of every placeholder. */
function Ground({ id, tint }: { id: string; tint: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-g`} cx="50%" cy="80%" r="70%">
          <stop offset="0" stopColor={tint} stopOpacity="0.35" />
          <stop offset="1" stopColor={tint} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="335" height="180" fill={PANEL} />
      <rect width="335" height="180" fill={`url(#${id}-g)`} />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1="0" x2="335" y1={128 + i * 8} y2={128 + i * 8} stroke={tint} strokeOpacity={0.08 + i * 0.02} strokeWidth="1" />
      ))}
    </>
  );
}

/** Three piles of crystals, small to large (the regular packs). */
export function HeroPiles() {
  const id = useId().replace(/:/g, '');
  const pile = (cx: number, base: number, sizes: number[]) => {
    const gems: { x: number; y: number; s: number; rot: number }[] = [];
    sizes.forEach((s, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      gems.push({ x: cx + (col - 1) * 22 * s - row * 6, y: base - row * 20 * s, s, rot: (col - 1) * 14 });
    });
    return gems;
  };
  const piles = [
    { gems: pile(64, 130, [0.9, 0.9, 0.9, 1]), glow: 0.18 },
    { gems: pile(167, 132, [1.1, 1.1, 1.1, 1.2, 1.2]), glow: 0.26 },
    { gems: pile(270, 134, [1.3, 1.3, 1.3, 1.4, 1.4, 1.5]), glow: 0.34 },
  ];
  return (
    <svg viewBox="0 0 335 180" width="100%" height="100%" aria-hidden="true" focusable="false">
      <Ground id={id} tint={CYAN} />
      {piles.map((p, i) => (
        <g key={i}>
          <ellipse cx={[64, 167, 270][i]} cy="142" rx={40 + i * 10} ry="8" fill={CYAN} opacity={p.glow} />
          {p.gems.map((g, j) => (
            <Gem key={j} x={g.x} y={g.y} s={g.s} rot={g.rot} color={j === p.gems.length - 1 ? GOLD : CYAN} />
          ))}
        </g>
      ))}
    </svg>
  );
}
