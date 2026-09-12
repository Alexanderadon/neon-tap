import type { GoalFamily } from '../model/goals';

/**
 * One glyph per achievement family — the same 15 marks on the badge wall and on the result screen,
 * so an earned badge is recognisable without reading its name. Plain strokes on a 24-unit grid,
 * current colour, no fills that fight the ring behind them.
 */
export function FamilyIcon({ family, size = 16 }: { family: GoalFamily; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  } as const;
  switch (family) {
    case 'pass': // a flag on a pole
      return (
        <svg {...p}>
          <path d="M6 21V4" />
          <path d="M6 4h11l-3 4 3 4H6" />
        </svg>
      );
    case 'combo': // a lightning bolt
      return (
        <svg {...p}>
          <path d="M13 2 5 14h6l-1 8 8-12h-6l1-8z" />
        </svg>
      );
    case 'rankS': // the letter S in a laurel-ish circle
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M14.5 9.2c-.4-1-1.3-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2 0 2.6 5.2 1.4 5.2 4.3 0 1.4-1.2 2.2-2.7 2.2-1.4 0-2.4-.6-2.8-1.7" />
        </svg>
      );
    case 'fullCombo': // a closed chain link pair
      return (
        <svg {...p}>
          <path d="M10 14a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.5 6.8" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.1-1.1" />
        </svg>
      );
    case 'stars': // a star
      return (
        <svg {...p}>
          <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
        </svg>
      );
    case 'slow': // a clock
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'heart': // a heart
      return (
        <svg {...p}>
          <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" />
        </svg>
      );
    case 'crystals': // a gem
      return (
        <svg {...p}>
          <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
          <path d="M3 9h18M9 4l3 5 3-5M12 9l-3 11M12 9l3 11" />
        </svg>
      );
    case 'daily': // a calendar with a dot
      return (
        <svg {...p}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 10h16M8 3v4M16 3v4" />
          <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'hardest': // a mountain peak
      return (
        <svg {...p}>
          <path d="M3 20 10 7l3 5 2-3 6 11H3z" />
        </svg>
      );
    case 'genres': // three sliders
      return (
        <svg {...p}>
          <path d="M5 4v16M12 4v16M19 4v16" />
          <circle cx="5" cy="9" r="2" fill="#0b0d16" />
          <circle cx="12" cy="15" r="2" fill="#0b0d16" />
          <circle cx="19" cy="7" r="2" fill="#0b0d16" />
        </svg>
      );
    case 'bought': // a shopping bag
      return (
        <svg {...p}>
          <path d="M6 8h12l1 12H5L6 8z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case 'perfects': // a target
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'attempts': // a play button repeated
      return (
        <svg {...p}>
          <path d="M8 5v14l11-7L8 5z" />
          <path d="M4 7v10" />
        </svg>
      );
    case 'custom': // a music note
      return (
        <svg {...p}>
          <path d="M9 18V6l10-2v12" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="16.5" cy="16" r="2.5" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
