import type { SVGProps } from 'react';

/** Stroke-2 round icons for buttons and rows (spec §4.1 `icons.tsx`); `Icon` fills with `currentColor`. */
export type IconName =
  | 'play'
  | 'pause'
  | 'stop'
  | 'arrow'
  | 'chevron'
  | 'lock'
  | 'sun'
  | 'infinity'
  | 'bag'
  | 'trophy'
  | 'user'
  | 'retry'
  | 'home'
  | 'duel'
  | 'check'
  | 'cross'
  | 'note'
  | 'file'
  | 'hourglass'
  | 'trash'
  | 'sound'
  | 'cloud-off'
  | 'tray'
  | 'book'
  | 'sliders'
  | 'ad'
  | 'back'
  | 'metro'
  | 'phones'
  | 'skip'
  | 'bubble'
  | 'sound-off'
  | 'gauge'
  | 'battery'
  | 'bolt'
  | 'cap'
  | 'share'
  | 'plus-square';

const PATHS: Record<IconName, string> = {
  play: 'M8 5v14l11-7z',
  pause: 'M8 5v14M16 5v14',
  stop: 'M7 7h10v10H7z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chevron: 'M9 6l6 6-6 6',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  infinity: 'M12 12c-1.8-2.6-3.4-4-5.5-4A4 4 0 0 0 6.5 16c2.1 0 3.7-1.4 5.5-4 1.8 2.6 3.4 4 5.5 4a4 4 0 0 0 0-8c-2.1 0-3.7 1.4-5.5 4z',
  bag: 'M5 8h14l-1 13H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0',
  retry: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  home: 'M3 11 12 4l9 7M5 10v10h14V10',
  duel: 'M4 4l11 11M20 4 9 15M6 18l-2 2M18 18l2 2M9 15l-3 3M15 15l3 3',
  check: 'M5 12l5 5L20 7',
  cross: 'M6 6l12 12M18 6 6 18',
  note: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6',
  hourglass: 'M6 3h12M6 21h12M8 3v4l4 5 4-5V3M8 21v-4l4-5 4 5v4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
  sound: 'M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  'cloud-off': 'M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 17 8.5M19 12a3.5 3.5 0 0 1-1 6.9H9M3 3l18 18',
  tray: 'M12 3v11M7.5 9.5 12 14l4.5-4.5M4 17.5v1a2.5 2.5 0 0 0 2.5 2.5h11a2.5 2.5 0 0 0 2.5-2.5v-1',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5ZM4 19a2 2 0 0 0 2 2h13M9 7h6',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M18 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM12 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  ad: 'M5 5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM10 9v5l4-2.5zM8 21h8',
  back: 'M19 12H5M11 6l-6 6 6 6',
  metro: 'M9 4h6l3 16H6L9 4ZM12 15l5-9M8 13h8',
  phones: 'M4 15v-3a8 8 0 0 1 16 0v3M4 16a2 2 0 0 1 4 0v2a2 2 0 0 1-4 0zM16 16a2 2 0 0 1 4 0v2a2 2 0 0 1-4 0z',
  skip: 'M5 5l9 7-9 7zM18 5v14',
  bubble: 'M4 5h16v11h-8l-4 4v-4H4zM8 9h8M8 12h5',
  'sound-off': 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4zM16 9.5l5 5M21 9.5l-5 5',
  gauge: 'M4 17a8 8 0 0 1 16 0M12 17l4-6M4 20h16',
  battery: 'M3 8h15v8H3zM21 11v2M7 11v2M10.5 11v2',
  bolt: 'M13 3 5 13h6l-1 8 8-10h-6z',
  cap: 'M3 9l9-4 9 4-9 4zM7 11v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5',
  share: 'M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1',
  'plus-square': 'M7.5 4h9a3.5 3.5 0 0 1 3.5 3.5v9a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5v-9A3.5 3.5 0 0 1 7.5 4zM12 8.5v7M8.5 12h7',
};

/** Icons drawn with a fill (the play triangle, the stop square) instead of a stroke. */
const FILLED: ReadonlySet<IconName> = new Set<IconName>(['play', 'stop']);

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** CSS size, px (both dimensions). Omit to let the parent's CSS size it. */
  size?: number;
}

export function Icon({ name, size, className, ...rest }: Props) {
  const filled = FILLED.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className ? `icon icon-${name} ${className}` : `icon icon-${name}`}
      aria-hidden="true"
      focusable="false"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? undefined : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
