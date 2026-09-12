import type { ReactElement, SVGProps } from 'react';

/** Hand-drawn 24×24 stroke icons for the hero and the reel — no emoji, colour from `currentColor`. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: IconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Solid triangle — the PLAY glyph. */
export function PlayIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Padlock with a keyhole. */
export function LockIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Five-point star — difficulty and star totals. */
export function StarIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.1 6.6 20l1.1-6.1L3.2 9.6l6.1-.8z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Trophy — records / attempt history. */
export function TrophyIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 4M17 6h2.5A2.5 2.5 0 0 1 17 10" />
      <path d="M12 14v3M8.5 20h7M10 17h4" />
    </Svg>
  );
}

/** Waveform with an upload arrow — "своя музыка". */
export function WaveIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M3 12h2l2-5 3 10 3-8 2 3h2" />
      <path d="M19 15v6M16.5 17.5 19 15l2.5 2.5" />
    </Svg>
  );
}

/** Fingertip tapping a lane — the tutorial. */
export function TapIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M9 11.5V6a2 2 0 1 1 4 0v5" />
      <path d="M13 10.5a2 2 0 0 1 4 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5.4-3.4L3.8 15a1.6 1.6 0 0 1 2.6-1.8L9 15.5" />
      <path d="M4 4.5 5.5 6M13 3l1.5-1.5" />
    </Svg>
  );
}

/** Small sun — the daily track. */
export function SunIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </Svg>
  );
}
