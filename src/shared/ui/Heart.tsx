import { useId } from 'react';

export type HeartState = 'on' | 'off' | 'gold';

interface Props {
  state: HeartState;
  /** CSS size, px. */
  size?: number;
  className?: string;
}

const HEART = 'M12 21.2 4.6 14A5.2 5.2 0 0 1 12 6.6a5.2 5.2 0 0 1 7.4 7.4Z';
const SHINE = 'M7.2 9.6a2.6 2.6 0 0 1 3-1.6';

/**
 * The heart of the HUD as an SVG (revive panel 40 px, shop and result 20 px): white glossy face when alive, the same
 * shape in dark grey when lost, gold with a radial halo when gilded (a life past five) — gradients and halo inside
 * the SVG, no CSS filters (the same sprites the canvas HUD draws).
 */
export function Heart({ state, size = 40, className }: Props) {
  const uid = useId().replace(/:/g, '');
  const face = `${uid}-f`;
  const glow = `${uid}-h`;
  const stops = state === 'on' ? ['#ffffff', '#cfd3e0', '#8a8fa3'] : state === 'gold' ? ['#fff3a0', '#ffd23f', '#ff8a00'] : ['#3a3d4c', '#23252f', '#15161d'];
  return (
    <svg
      className={['heart', `heart-${state}`, className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      overflow="visible"
    >
      <defs>
        <linearGradient id={face} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.45" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
        {state === 'gold' && (
          <radialGradient id={glow}>
            <stop offset="0" stopColor="#ffd700" stopOpacity="0.5" />
            <stop offset="0.6" stopColor="#ffd700" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ffd700" stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      {state === 'gold' && <circle cx="12" cy="13" r="13" fill={`url(#${glow})`} />}
      <path
        d={HEART}
        fill={`url(#${face})`}
        stroke={state === 'gold' ? '#8a4500' : '#000'}
        strokeOpacity={state === 'gold' ? 1 : 0.6}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d={SHINE} fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity={state === 'off' ? 0.08 : state === 'gold' ? 0.7 : 0.8} />
    </svg>
  );
}
