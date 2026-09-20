import { useId, type CSSProperties } from 'react';
import {
  CROWN_BAND_TOP,
  CROWN_FACETS,
  CROWN_GEM,
  CROWN_LIT_EDGES,
  CROWN_OUTLINE,
  CROWN_PEARLS,
  RIM_GOLD,
  RIM_OFF,
  STAR_FACETS,
  STAR_LIT_EDGES,
  STAR_OUTLINE,
  STAR_SPARKLE,
  STAR_SPECULAR,
  facetTone,
  type GemDetail,
  type Point,
} from '@/shared/lib/render/gems';
import './stars.css';

export type StarsSize = 'sm' | 'md' | 'hero' | 'xl';

interface Props {
  /** Filled stars. */
  value: number;
  max?: number;
  /** Slots from the left that are crowns instead of stars (endless mode: a crown per extra loop). */
  crowns?: number;
  /** sm = inline 16 px (chips, unlock bar), md = card row 26 px, hero = the result screen's 96 / 120 / 96 (xl is its old name). */
  size?: StarsSize;
  /** Pop the glyphs in one after another with sparks (the result screen). */
  animate?: boolean;
  /** Radial halo behind earned glyphs (default: hero only). */
  halo?: boolean;
  className?: string;
}

/** Seconds before the first glyph pops and between glyphs (spec §3: 0.3 / 0.7 / 1.1). */
const POP_DELAY = 0.3;
const POP_STEP = 0.4;
/** Sparks leave 0.15 s after their glyph lands. */
const SPARK_LAG = 0.15;
const SPARK_COUNT = 12;

/** Spark directions: twelve sticks around the glyph, jittered deterministically so the burst is not a perfect wheel. */
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, i) => ({
  angle: Math.round(i * 30 + ((i * 7) % 5) - 2),
  length: 56 + ((i * 11) % 21),
  gold: i % 2 === 0,
}));

const pts = (points: readonly Point[]): string => points.map(([x, y]) => `${x},${y}`).join(' ');
const edgePath = (lines: readonly (readonly [Point, Point])[]): string => lines.map(([a, b]) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`).join('');

/**
 * Level stars — the game's currency, drawn the same everywhere (the HUD sprites use the same
 * geometry): a gem-cut gold star lit from the top-left when earned, the same cut in dark grey
 * while it is still to be won. A slot below `crowns` is a crown — the endless mode's reward.
 * The hero sizes get the full gem cut; the chip and card sizes get one smooth face (ten facets at
 * 16–26 px read as noise). The halo is a radial gradient inside the SVG — no CSS filters (iOS
 * draws squares).
 */
export function Stars({ value, max = 3, crowns = 0, size = 'sm', animate = false, halo, className }: Props) {
  const uid = useId().replace(/:/g, '');
  const hero = size === 'hero' || size === 'xl';
  const withHalo = halo ?? hero;
  const detail: GemDetail = hero ? 'full' : 'simple';
  const cls = ['stars', hero ? 'stars-hero' : `stars-${size}`, animate && 'stars-animate', className].filter(Boolean).join(' ');
  const bigIndex = max % 2 === 1 ? (max - 1) / 2 : -1;
  return (
    <span className={cls} aria-label={`${value} / ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < value;
        const crown = i < crowns;
        const delay = POP_DELAY + i * POP_STEP;
        const wrapCls = ['star-wrap', on ? 'star-wrap-on' : 'star-wrap-off', hero && i === bigIndex && 'star-wrap-big'].filter(Boolean).join(' ');
        const style: CSSProperties | undefined = animate ? { animationDelay: `${delay.toFixed(2)}s` } : undefined;
        const id = `${uid}-${i}`;
        return (
          <span key={i} className={wrapCls} style={style}>
            {crown ? <Crown id={id} on={on} halo={withHalo && on} detail={detail} /> : <Star id={id} on={on} halo={withHalo && on} detail={detail} />}
            {hero && animate && on && (
              <span className="star-sparks" aria-hidden="true">
                {SPARKS.map((s, k) => (
                  <i
                    key={k}
                    className={s.gold ? 'star-spark star-spark-gold' : 'star-spark'}
                    style={{ '--a': `${s.angle}deg`, '--l': `${s.length}px`, animationDelay: `${(delay + SPARK_LAG).toFixed(2)}s` } as CSSProperties}
                  />
                ))}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

interface GlyphProps {
  /** Unique id prefix for the gradient defs (one per rendered glyph). */
  id: string;
  on: boolean;
  halo?: boolean;
  /** 'full' = the gem cut (big glyphs); 'simple' = one smooth face (default: the small icon sizes). */
  detail?: GemDetail;
  className?: string;
}

/** The small glyph's face: one diagonal gradient, lit from the top-left. */
function SmoothFace({ id, on }: { id: string; on: boolean }) {
  return (
    <defs>
      <linearGradient id={id} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={facetTone(1, on)} />
        <stop offset="0.45" stopColor={facetTone(0.62, on)} />
        <stop offset="1" stopColor={facetTone(0.08, on)} />
      </linearGradient>
    </defs>
  );
}

function Halo({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor="#ffd700" stopOpacity="0.5" />
          <stop offset="0.6" stopColor="#ffd700" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffd700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="star-halo" cx="12" cy="12.5" r="17" fill={`url(#${id})`} />
    </>
  );
}

/** One star glyph, self-contained. Used by Stars and by anything that needs a single star icon. */
export function Star({ id, on, halo = false, detail = 'simple', className }: GlyphProps) {
  const s = STAR_SPECULAR;
  if (detail === 'simple')
    return (
      <svg className={['star', on ? 'star-on' : 'star-off', className].filter(Boolean).join(' ')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {halo && <Halo id={`${id}-h`} />}
        <SmoothFace id={`${id}-f`} on={on} />
        <polygon points={pts(STAR_OUTLINE)} fill={`url(#${id}-f)`} stroke={on ? RIM_GOLD : RIM_OFF} strokeWidth="1.3" strokeLinejoin="round" />
        <ellipse cx="9.6" cy="7.6" rx="2.4" ry="3.6" transform="rotate(-40 9.6 7.6)" fill="#fff" opacity={on ? 0.55 : 0.07} />
      </svg>
    );
  return (
    <svg className={['star', on ? 'star-on' : 'star-off', className].filter(Boolean).join(' ')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {halo && <Halo id={`${id}-h`} />}
      {STAR_FACETS.map((f, i) => (
        <polygon key={i} points={pts(f.points)} fill={facetTone(f.brightness, on)} />
      ))}
      <polygon points={pts(STAR_OUTLINE)} fill="none" stroke={on ? RIM_GOLD : RIM_OFF} strokeWidth="1.3" strokeLinejoin="round" />
      <path d={edgePath(STAR_LIT_EDGES)} fill="none" stroke="#fff" strokeOpacity={on ? 0.62 : 0.1} strokeWidth="0.75" strokeLinecap="round" />
      {on && (
        <>
          <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={`rotate(${s.rotate} ${s.cx} ${s.cy})`} fill="#fff" opacity="0.85" />
          <circle cx={STAR_SPARKLE[0]} cy={STAR_SPARKLE[1]} r="0.7" fill="#fff" opacity="0.7" />
        </>
      )}
    </svg>
  );
}

/** One crown glyph — the endless mode's reward: gem-cut peaks with pearls, a banded base with the cyan gem. */
export function Crown({ id, on, halo = false, detail = 'simple', className }: GlyphProps) {
  const band = `${id}-b`;
  const pearl = `${id}-p`;
  const gem = `${id}-g`;
  const simple = detail === 'simple';
  return (
    <svg
      className={['star', 'crown', on ? 'star-on' : 'star-off', className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {halo && <Halo id={`${id}-h`} />}
      <defs>
        <linearGradient id={band} x1="0" y1={CROWN_BAND_TOP} x2="0" y2="20.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={facetTone(0.8, on)} />
          <stop offset="0.5" stopColor={facetTone(0.55, on)} />
          <stop offset="1" stopColor={facetTone(0.1, on)} />
        </linearGradient>
        <radialGradient id={pearl} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor={on ? '#ffffff' : '#5a5e70'} />
          <stop offset="0.7" stopColor={on ? '#d9dcea' : '#30333f'} />
          <stop offset="1" stopColor={on ? '#8a8fa3' : '#1c1e26'} />
        </radialGradient>
        <radialGradient id={gem} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={on ? '#d8fbff' : '#3a3d4c'} />
          <stop offset="0.55" stopColor={on ? '#00f0ff' : '#23252f'} />
          <stop offset="1" stopColor={on ? '#0090a8' : '#15161d'} />
        </radialGradient>
      </defs>
      {simple && <SmoothFace id={`${id}-f`} on={on} />}
      {simple ? (
        <polygon points={pts(CROWN_OUTLINE)} fill={`url(#${id}-f)`} />
      ) : (
        CROWN_FACETS.map((f, i) => <polygon key={i} points={pts(f.points)} fill={facetTone(f.brightness, on)} />)
      )}
      {!simple && <rect x="3" y={CROWN_BAND_TOP} width="18" height={20.5 - CROWN_BAND_TOP} fill={`url(#${band})`} />}
      <path d={`M3 ${CROWN_BAND_TOP + 0.4}H21`} stroke={on ? '#7a3a00' : '#000'} strokeOpacity={on ? 0.55 : 0.5} strokeWidth="0.8" />
      <polygon points={pts(CROWN_OUTLINE)} fill="none" stroke={on ? RIM_GOLD : RIM_OFF} strokeWidth="1.3" strokeLinejoin="round" />
      {!simple && (
        <path
          d={`${edgePath(CROWN_LIT_EDGES)}M3.6 ${CROWN_BAND_TOP + 1.2}H20.4`}
          fill="none"
          stroke="#fff"
          strokeOpacity={on ? 0.5 : 0.08}
          strokeWidth="0.75"
          strokeLinecap="round"
        />
      )}
      {CROWN_PEARLS.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={`url(#${pearl})`} stroke={on ? RIM_GOLD : RIM_OFF} strokeWidth="0.6" />
      ))}
      <circle cx={CROWN_GEM.cx} cy={CROWN_GEM.cy} r={CROWN_GEM.r} fill={`url(#${gem})`} stroke={on ? RIM_GOLD : RIM_OFF} strokeWidth="0.7" />
    </svg>
  );
}
