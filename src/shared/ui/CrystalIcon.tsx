import { useId, type SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
  /** CSS size, px (both dimensions). */
  size?: number;
  /** Cyan radial halo behind the gem, drawn inside the SVG (no CSS filter — iOS draws squares). */
  halo?: boolean;
}

/**
 * Crystal glyph for the wallet, shop and track cards — hand-made inline SVG (no emoji, GDD rule).
 * Fills with `currentColor`, so the parent's colour and text-shadow drive its neon look.
 */
export function CrystalIcon({ size = 14, halo = false, className, ...rest }: Props) {
  const gid = `${useId().replace(/:/g, '')}-h`;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className ? `crystal-icon ${className}` : 'crystal-icon'}
      aria-hidden="true"
      focusable="false"
      overflow="visible"
      {...rest}
    >
      {halo && (
        <>
          <defs>
            <radialGradient id={gid}>
              <stop offset="0" stopColor="currentColor" stopOpacity="0.45" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="12" cy="12" r="13" fill={`url(#${gid})`} />
        </>
      )}
      <path d="M12 2 L20 9 L12 22 L4 9 Z" fill="currentColor" opacity="0.9" />
      <path d="M12 2 L20 9 L12 22 Z" fill="#fff" opacity="0.22" />
      <path d="M4 9 L20 9 L12 22 Z" fill="#000" opacity="0.18" />
      <path d="M8 9 L12 2 L16 9" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.7" strokeLinejoin="round" />
    </svg>
  );
}
