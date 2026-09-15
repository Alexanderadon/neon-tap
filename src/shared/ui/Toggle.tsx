import './toggle.css';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  'aria-label': string;
}

/** Toggle 48 × 28 (screens-onboard notes): w10 / cyan track, 24 px white disc with a 2 px underside. The only switch in the game. */
export function Toggle({ checked, onChange, ...rest }: Props) {
  return (
    <span className={checked ? 'tgl tgl-on' : 'tgl'}>
      <input
        className="tgl-input"
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={checked}
        aria-label={rest['aria-label']}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i className="tgl-knob" aria-hidden="true" />
    </span>
  );
}
