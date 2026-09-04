import './ui.css';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  hint?: string;
  onChange: (v: number) => void;
}

export function Slider({ label, value, min, max, step, format, hint, onChange }: Props) {
  return (
    <label className="slider">
      <span className="slider-head">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <span className="slider-hint">{hint}</span>}
    </label>
  );
}
