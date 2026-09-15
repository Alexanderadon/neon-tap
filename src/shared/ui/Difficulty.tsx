import { dict, fmt } from '@/shared/i18n';
import { Chip } from './Chip';
import { difficultyColor } from './difficultyColor';

/** The difficulty flame, 16 px by default, coloured by tier (gradients live in the path, no CSS filter). */
export function FlameIcon({ color, size = 16, className }: { color: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ color }} className={className} aria-hidden="true" focusable="false">
      <path d="M12 2c0 0-6 6-6 11.5a6 6 0 0 0 12 0c0-2.6-1.4-4.8-2.6-6.2 0 2-1 3.2-2.2 3.4C13.7 8 13.2 4.8 12 2z" fill="currentColor" />
      <path d="M12 11.8c0 0-2.8 2.7-2.8 5.1a2.8 2.8 0 0 0 5.6 0c0-1.6-1.2-3-2.8-5.1z" fill="#fff" opacity="0.7" />
    </svg>
  );
}

interface Props {
  /** Song difficulty, 1–10. */
  stars: number;
  className?: string;
}

/**
 * Song difficulty as the design system's chip (spec §2.2): the dark 32 px chip with the flame 16
 * in the tier's colour and the white number. A flame, not a star — stars are what the player earns.
 */
export function Difficulty({ stars, className }: Props) {
  const label = fmt(dict.difficultyLabel, { n: stars });
  return (
    <Chip
      variant="dark"
      className={['chip-flame', className].filter(Boolean).join(' ')}
      icon={<FlameIcon color={difficultyColor(stars)} />}
      aria-label={label}
      title={label}
    >
      {stars}
    </Chip>
  );
}
