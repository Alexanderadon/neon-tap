import { LANE_COUNT } from '@/shared/config/constants';

export interface Layout {
  width: number;
  height: number;
  lanes: number;
  /** Left edge of the lane area. */
  laneX: number;
  laneWidth: number;
  laneAreaWidth: number;
  hitY: number;
  noteHeight: number;
  /** Bottom part of the screen used as touch zones on mobile. */
  touchZoneTop: number;
  portrait: boolean;
}

export function computeLayout(width: number, height: number, touch: boolean, lanes = LANE_COUNT): Layout {
  const portrait = height > width;
  const laneAreaWidth = portrait ? width : Math.min(width, Math.max(360, height * 0.62));
  const laneWidth = laneAreaWidth / lanes;
  const hitY = Math.round(height * (touch ? 0.8 : 0.86));
  const noteHeight = Math.round(Math.min(34, Math.max(14, laneWidth * 0.26)));
  return {
    width,
    height,
    lanes,
    laneX: Math.round((width - laneAreaWidth) / 2),
    laneWidth,
    laneAreaWidth,
    hitY,
    noteHeight,
    touchZoneTop: height * 0.5,
    portrait,
  };
}

/** Pointer → lane. Touch: bottom half of the screen is split into `lanes` full-width zones (GDD §4). */
export function laneAtPoint(layout: Layout, x: number, y: number, touch: boolean): number {
  const n = layout.lanes;
  const zone = () => Math.min(n - 1, Math.max(0, Math.floor(x / (layout.width / n))));
  if (touch && y >= layout.touchZoneTop) return zone();
  const rel = x - layout.laneX;
  if (rel < 0 || rel >= layout.laneAreaWidth) return touch ? zone() : -1;
  return Math.floor(rel / layout.laneWidth);
}
