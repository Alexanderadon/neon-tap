import { useId, type ReactNode } from 'react';
import type { AvatarId } from '@/shared/config/avatars';
import { avatarMeta } from '../model/catalogue';

/**
 * The bold glyph of each character, drawn in `currentColor` (the sphere's dark ink) on a 64 × 64
 * field: ears, antenna, visor, fin … — enough to tell them apart at 32 px. Light details are white.
 */
const GLYPHS: Record<AvatarId, ReactNode> = {
  cat: (
    <>
      <path d="M13 27 18 8l11 13zM51 27 46 8 35 21z" />
      <path d="M15 32a17 17 0 0 1 34 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <rect x="10" y="29" width="9" height="13" rx="3" />
      <rect x="45" y="29" width="9" height="13" rx="3" />
      <ellipse cx="25" cy="36" rx="2.5" ry="3.5" />
      <ellipse cx="39" cy="36" rx="2.5" ry="3.5" />
      <path d="M29.5 43h5L32 46z" />
      <path d="M27 48q5 4 10 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  fox: (
    <>
      <path d="M11 30 16 5l13 14zM53 30 48 5 35 19z" />
      <path d="M22 34l7 3M42 34l-7 3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M29 44h6l-3 4z" />
      <circle cx="46" cy="47" r="9" />
      <circle cx="46" cy="47" r="2.5" fill="#fff" />
      <path d="M40.5 43a7 7 0 0 1 5.5-3" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  robot: (
    <>
      <path d="M32 8v9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="7" r="3.5" />
      <rect x="13" y="21" width="38" height="16" rx="5" />
      <rect x="20" y="26" width="8" height="6" rx="1.5" fill="#fff" />
      <rect x="36" y="26" width="8" height="6" rx="1.5" fill="#fff" />
      <rect x="23" y="43" width="18" height="7" rx="2" />
      <path d="M29 43v7M35 43v7" fill="none" stroke="#fff" strokeWidth="1.5" />
      <circle cx="8" cy="29" r="2.5" />
      <circle cx="56" cy="29" r="2.5" />
    </>
  ),
  astronaut: (
    <>
      <ellipse cx="32" cy="31" rx="19" ry="16" />
      <path d="M19 27q5-9 15-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <rect x="18" y="49" width="28" height="7" rx="3" />
    </>
  ),
  panda: (
    <>
      <circle cx="15" cy="15" r="8" />
      <circle cx="49" cy="15" r="8" />
      <ellipse cx="24" cy="29" rx="6" ry="7" transform="rotate(-15 24 29)" />
      <ellipse cx="40" cy="29" rx="6" ry="7" transform="rotate(15 40 29)" />
      <circle cx="25" cy="30" r="2" fill="#fff" />
      <circle cx="39" cy="30" r="2" fill="#fff" />
      <path d="M29 38h6l-3 3z" />
      <rect x="16" y="45" width="32" height="12" rx="2" />
      <circle cx="23" cy="51" r="3.5" fill="#fff" />
      <circle cx="41" cy="51" r="3.5" fill="#fff" />
      <rect x="29" y="48" width="6" height="6" rx="1" fill="#fff" />
    </>
  ),
  alien: (
    <>
      <path d="M23 14l-6-9M41 14l6-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="4" r="2.5" />
      <circle cx="48" cy="4" r="2.5" />
      <ellipse cx="23" cy="32" rx="6" ry="10" transform="rotate(20 23 32)" />
      <ellipse cx="41" cy="32" rx="6" ry="10" transform="rotate(-20 41 32)" />
      <path d="M28 48q4 3 8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  dragon: (
    <>
      <path d="M20 22c-4-6-8-10-12-12 6 0 12 3 19 9zM44 22c4-6 8-10 12-12-6 0-12 3-19 9z" />
      <path d="M22 30l7 3M42 30l-7 3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="28" cy="41" r="1.8" />
      <circle cx="36" cy="41" r="1.8" />
      <path d="M44 44c4 3 5 8 2 13-1-3-3-4-3-1-3-3-3-8 1-12z" />
    </>
  ),
  owl: (
    <>
      <path d="M14 22 18 6l8 12zM50 22 46 6l-8 12z" />
      <circle cx="22" cy="32" r="9" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="42" cy="32" r="9" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M31 32h2M13 30l-5-3M51 30l5-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="32" r="3" />
      <circle cx="42" cy="32" r="3" />
      <path d="M28 43h8l-4 7z" />
    </>
  ),
  shark: (
    <>
      <path d="M23 24 36 5l5 19z" />
      <circle cx="24" cy="32" r="2.5" />
      <path d="M46 30v8M50 31v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 44l4-5 4 5 4-5 4 5 4-5 4 5 4-5 4 5 4-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </>
  ),
  bunny: (
    <>
      <rect x="19" y="4" width="9" height="26" rx="4.5" transform="rotate(-8 23.5 17)" />
      <rect x="36" y="4" width="9" height="26" rx="4.5" transform="rotate(8 40.5 17)" />
      <rect x="15" y="27" width="34" height="9" rx="4.5" />
      <path d="M47 30l12 3-12 3z" />
      <circle cx="25" cy="43" r="2.5" />
      <circle cx="39" cy="43" r="2.5" />
      <path d="M29.5 49h5L32 52z" />
    </>
  ),
  ghost: (
    <>
      <path d="M14 55V30a18 18 0 0 1 36 0v25l-6-6-6 6-6-6-6 6-6-6z" />
      <ellipse cx="25" cy="31" rx="3" ry="4.5" fill="#fff" />
      <ellipse cx="39" cy="31" rx="3" ry="4.5" fill="#fff" />
      <circle cx="32" cy="41" r="2.5" fill="#fff" />
    </>
  ),
  dino: (
    <>
      <path d="M17 24 21 7l5 15 4-18 4 18 4-15 5 17z" />
      <circle cx="25" cy="33" r="2.8" />
      <circle cx="39" cy="33" r="2.8" />
      <circle cx="32" cy="40" r="1.5" />
      <path d="M18 44h28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 44l3 5 3-5zM36 44l3 5 3-5z" />
    </>
  ),
};

/**
 * The procedural placeholder of an avatar until its art file exists: the same glossy sphere as
 * the letter avatar (white light at 40 % / 35 %, the accent, the dark underside) in the character's
 * hue, with its glyph in the sphere's ink. Fills its box; no `filter` (iOS).
 */
export function AvatarEmblem({ id, className }: { id: AvatarId; className?: string }) {
  const { accent, under } = avatarMeta(id);
  const gradId = `${useId().replace(/:/g, '')}-ava`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={gradId} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.45" stopColor={accent} />
          <stop offset="1" stopColor={under} />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${gradId})`} />
      <g fill="currentColor" opacity="0.9">
        {GLYPHS[id]}
      </g>
    </svg>
  );
}
