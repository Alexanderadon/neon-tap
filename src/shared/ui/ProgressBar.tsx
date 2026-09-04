import './ui.css';

interface Props {
  /** 0..1 */
  value: number;
  label?: string;
  color?: string;
}

export function ProgressBar({ value, label, color = '#00f0ff' }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="progress">
      {label && <div className="progress-label">{label}</div>}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px ${color}` }} />
      </div>
    </div>
  );
}
