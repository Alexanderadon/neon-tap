import { createElement, useMemo, type CSSProperties, type ReactElement } from 'react';
import type { TrackGenre } from '@/shared/types/chart';
import { coverSpec, type CoverShape } from '../model/cover';

export interface TrackCoverProps {
  /** Track id — seeds the deterministic art. */
  id: string;
  genre?: TrackGenre;
  /** CSS size (both dimensions); defaults to filling the parent width at 1:1. */
  size?: number | string;
  title?: string;
  className?: string;
}

/**
 * Procedural 1:1 cover — inline SVG, no assets. Same `id` + `genre` → identical markup,
 * so it can be shown on the track card and on the result screen. Renders fine from 48 px to 240 px.
 */
export function TrackCover({ id, genre, size, title, className }: TrackCoverProps): ReactElement {
  const spec = useMemo(() => coverSpec(id, genre), [id, genre]);
  const gid = `cg-${spec.seed.toString(36)}`;
  const style: CSSProperties | undefined = size !== undefined ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 100 100"
      className={className ? `track-cover ${className}` : 'track-cover'}
      style={style}
      role="img"
      aria-label={title ?? id}
      data-genre={spec.genre}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={spec.palette.bg[0]} />
          <stop offset="1" stopColor={spec.palette.bg[1]} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill={`url(#${gid})`} />
      {spec.shapes.map((s, i) => shapeElement(s, i))}
      <rect x="0" y="0" width="100" height="100" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
    </svg>
  );
}

function shapeElement(s: CoverShape, key: number): ReactElement {
  switch (s.kind) {
    case 'rect':
      return createElement('rect', { key, x: s.x, y: s.y, width: s.w, height: s.h, fill: s.fill, opacity: s.opacity, rx: s.rx });
    case 'circle':
      return createElement('circle', { key, cx: s.cx, cy: s.cy, r: s.r, fill: s.fill, opacity: s.opacity, stroke: s.stroke, strokeWidth: s.strokeWidth });
    case 'path':
      return createElement('path', { key, d: s.d, fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, opacity: s.opacity, strokeLinejoin: 'round' });
    case 'line':
      return createElement('line', { key, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, stroke: s.stroke, strokeWidth: s.strokeWidth, opacity: s.opacity, strokeLinecap: 'round' });
  }
}
