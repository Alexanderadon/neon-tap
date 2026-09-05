import type { ReactElement, SVGProps } from 'react';

/** Hand-drawn 24×24 stroke icons for the dock — no emoji, colour from `currentColor`. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: IconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
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

/** Play triangle over a short strip of "covers" — jumps to the reel. */
export function DockPlayIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M9 4.5v11l9-5.5z" fill="currentColor" stroke="none" />
      <path d="M4 20h4M10 20h4M16 20h4" />
    </Svg>
  );
}

/** Shopping bag with a rounded handle. */
export function DockShopIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M5.5 8.5h13l-1 11.5h-11z" />
      <path d="M9 8.5V6.8a3 3 0 0 1 6 0v1.7" />
      <path d="M9.5 12.5v1.2M14.5 12.5v1.2" />
    </Svg>
  );
}

/** Target rings — goals. */
export function DockGoalsIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2" />
    </Svg>
  );
}

/** Trophy — records. */
export function DockRecordsIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 4M17 6h2.5A2.5 2.5 0 0 1 17 10" />
      <path d="M12 14v3M8.5 20h7M10 17h4" />
    </Svg>
  );
}

/** Three sliders — settings. */
export function DockSettingsIcon(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="#05060a" />
      <circle cx="15.5" cy="12" r="2" fill="#05060a" />
      <circle cx="7.5" cy="17" r="2" fill="#05060a" />
    </Svg>
  );
}
