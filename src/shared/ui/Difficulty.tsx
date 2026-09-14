import { dict, fmt } from '@/shared/i18n';
import { difficultyColor } from './difficultyColor';
import './ui.css';

interface Props {
  /** Song difficulty, 1–10. */
  stars: number;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Song difficulty: a neon flame plus the number, coloured by tier (lime → cyan → yellow →
 * orange → red). A flame, not a star — stars are what the player earns.
 */
export function Difficulty({ stars, size = 'sm', className }: Props) {
  const color = difficultyColor(stars);
  const cls = ['difficulty', `difficulty-${size}`, className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={{ color }} aria-label={fmt(dict.difficultyLabel, { n: stars })} title={fmt(dict.difficultyLabel, { n: stars })}>
      <svg className="difficulty-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2c0 0-6 6-6 11.5a6 6 0 0 0 12 0c0-2.6-1.4-4.8-2.6-6.2 0 2-1 3.2-2.2 3.4C13.7 8 13.2 4.8 12 2z" fill="currentColor" opacity="0.95" />
        <path d="M12 11.8c0 0-2.8 2.7-2.8 5.1a2.8 2.8 0 0 0 5.6 0c0-1.6-1.2-3-2.8-5.1z" fill="#fff" opacity="0.7" />
      </svg>
      <span className="difficulty-n">{stars}</span>
    </span>
  );
}
