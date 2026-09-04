import { LANE_COUNT } from '@/shared/config/constants';

export interface Layout {
  width: number;
  height: number;
  /** Left edge of the lane area. */
  laneX: number;
  laneWidth: number;
  laneAreaWidth: number;
  hitY: number;
  noteHeight: number;
  /** Bottom part of the screen used as 4 touch zones on mobile. */
  touchZoneTop: number;
  portrait: boolean;
}

export function computeLayout(width: number, height: number, touch: boolean): Layout {
  const portrait = height > width;
  const laneAreaWidth = portrait ? width : Math.min(width, Math.max(360, height * 0.62));
  const laneWidth = laneAreaWidth / LANE_COUNT;
  const hitY = Math.round(height * (touch ? 0.8 : 0.86));
  const noteHeight = Math.round(Math.min(34, Math.max(16, laneWidth * 0.26)));
  return {
    width,
    height,
    laneX: Math.round((width - laneAreaWidth) / 2),
    laneWidth,
    laneAreaWidth,
    hitY,
    noteHeight,
    touchZoneTop: height * 0.5,
    portrait,
  };
}

/** Pointer → lane. Touch: bottom half of the screen is split into 4 full-width zones (GDD §4). */
export function laneAtPoint(layout: Layout, x: number, y: number, touch: boolean): number {
  if (touch && y >= layout.touchZoneTop) return Math.min(LANE_COUNT - 1, Math.max(0, Math.floor(x / (layout.width / LANE_COUNT))));
  const rel = x - layout.laneX;
  if (rel < 0 || rel >= layout.laneAreaWidth) return touch ? Math.min(LANE_COUNT - 1, Math.max(0, Math.floor(x / (layout.width / LANE_COUNT)))) : -1;
  return Math.floor(rel / layout.laneWidth);
}
