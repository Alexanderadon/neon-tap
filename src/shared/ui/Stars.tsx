import './ui.css';

interface Props {
  /** Filled stars. */
  value: number;
  max?: number;
  size?: 'sm' | 'md';
}

export function Stars({ value, max = 3, size = 'sm' }: Props) {
  return (
    <span className={`stars stars-${size}`} aria-label={`${value} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? 'star star-on' : 'star'}>
          ★
        </span>
      ))}
    </span>
  );
}
