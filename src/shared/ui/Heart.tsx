import { useId } from 'react';

export type HeartState = 'on' | 'off';

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
 * shape in dark grey when lost — the gradient inside the SVG, no CSS filters (the same sprites the canvas HUD draws;
 * lives past five are a «+N» there, never a gilded heart).
 */
export function Heart({ state, size = 40, className }: Props) {
  const face = `${useId().replace(/:/g, '')}-f`;
  const stops = state === 'on' ? ['#ffffff', '#cfd3e0', '#8a8fa3'] : ['#3a3d4c', '#23252f', '#15161d'];
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
      </defs>
      <path d={HEART} fill={`url(#${face})`} stroke="#000" strokeOpacity={0.6} strokeWidth="1.3" strokeLinejoin="round" />
      <path d={SHINE} fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity={state === 'off' ? 0.08 : 0.8} />
    </svg>
  );
}
