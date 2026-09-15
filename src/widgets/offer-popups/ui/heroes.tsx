import { useId } from 'react';

/*
 * Procedural hero placeholders, 335 × 180, drawn in the neon palette (the exact hexes of the
 * design system). Everything is plain SVG paint — gradients, strokes, opacity — no CSS filter.
 * They stand in until `public/offers/<name>.webp` exists.
 */

const CYAN = '#00f0ff';
const GOLD = '#ffd700';
const MAG = '#ff2bd6';
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

/** Fan of eight cards (the music pack): the deck's cards spread from a pivot below the frame. */
export function HeroCards() {
  const id = useId().replace(/:/g, '');
  const colors = [CYAN, MAG, GOLD, CYAN, MAG, GOLD, CYAN, MAG];
  return (
    <svg viewBox="0 0 335 180" width="100%" height="100%" aria-hidden="true" focusable="false">
      <Ground id={id} tint={MAG} />
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {colors.map((c, i) => {
        const a = -42 + i * 12;
        return (
          <g key={i} transform={`translate(167 250) rotate(${a}) translate(-40 -200)`}>
            <rect x="0" y="0" width="80" height="112" rx="12" fill={PANEL} stroke="rgba(255,255,255,0.12)" />
            <rect x="0" y="0" width="80" height="112" rx="12" fill={`url(#${id}-face)`} />
            <rect x="8" y="8" width="64" height="56" rx="8" fill={c} opacity="0.85" />
            <rect x="8" y="8" width="64" height="56" rx="8" fill="#000" opacity="0.25" />
            <circle cx="40" cy="36" r="14" fill="#05060a" />
            <path d="M36 29 L47 36 L36 43 Z" fill={c} />
            <rect x="8" y="74" width="44" height="6" rx="3" fill="#fff" opacity="0.5" />
            <rect x="8" y="86" width="28" height="4" rx="2" fill="#fff" opacity="0.25" />
          </g>
        );
      })}
      <rect x="0" y="0" width="335" height="180" fill="none" />
    </svg>
  );
}

/** An open chest with crystals and rays (the 48-hour deal). */
export function HeroChest() {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 335 180" width="100%" height="100%" aria-hidden="true" focusable="false">
      <Ground id={id} tint={GOLD} />
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a5a" />
          <stop offset="1" stopColor="#1a1430" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3a0" />
          <stop offset="0.45" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#ff8a00" />
        </linearGradient>
      </defs>
      {/* rays */}
      <g transform="translate(167 108)">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M0 0 L-9 -150 L9 -150 Z" fill={GOLD} opacity={i % 2 ? 0.08 : 0.16} transform={`rotate(${-82 + i * 15})`} />
        ))}
      </g>
      {/* lid, open */}
      <g transform="translate(167 92) rotate(-28) translate(-70 0)">
        <rect x="0" y="-36" width="140" height="40" rx="12" fill={`url(#${id}-wood)`} stroke="rgba(255,255,255,0.14)" />
        <rect x="0" y="-12" width="140" height="8" fill={`url(#${id}-gold)`} />
      </g>
      {/* crystals in the chest */}
      <Gem x={135} y={98} s={1.7} rot={-18} />
      <Gem x={167} y={88} s={2.2} />
      <Gem x={199} y={98} s={1.7} rot={18} />
      <Gem x={151} y={104} s={1.3} color={MAG} rot={-8} />
      <Gem x={184} y={104} s={1.3} color={MAG} rot={8} />
      {/* body */}
      <rect x="97" y="100" width="140" height="60" rx="12" fill={`url(#${id}-wood)`} stroke="rgba(255,255,255,0.14)" />
      <rect x="97" y="100" width="140" height="8" fill={`url(#${id}-gold)`} />
      <rect x="97" y="124" width="140" height="6" fill={`url(#${id}-gold)`} opacity="0.8" />
      <rect x="157" y="112" width="20" height="24" rx="5" fill={`url(#${id}-gold)`} />
      <circle cx="167" cy="122" r="3" fill="#7a3a00" />
      <rect x="97" y="156" width="140" height="4" rx="2" fill="#000" />
    </svg>
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
