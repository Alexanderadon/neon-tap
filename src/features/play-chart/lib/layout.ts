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

/**
 * A single lane never spans the whole screen: one Magic-Tiles-style column in the middle.
 * The touch zone still covers the whole bottom half (see `touchZoneWidth`).
 */
export const SINGLE_LANE_MAX_WIDTH = 220;

export function computeLayout(width: number, height: number, touch: boolean, lanes = LANE_COUNT): Layout {
  const portrait = height > width;
  const fullArea = portrait ? width : Math.min(width, Math.max(360, height * 0.62));
  const laneAreaWidth = lanes === 1 ? Math.min(fullArea, SINGLE_LANE_MAX_WIDTH) : fullArea;
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

/** Minimum comfortable touch target (Material: 48 px, Apple HIG: 44 pt). */
export const MIN_TOUCH_ZONE_PX = 48;

export interface TouchZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Touch zones always span the full viewport width (not just the lane area), so in landscape the
 * zones are wider than the lanes above them, and a single lane's zone is the whole bottom half.
 * `laneAtPoint` uses exactly this split.
 */
export function touchZoneWidth(layout: Layout): number {
  return layout.width / layout.lanes;
}

/** Rectangle of the touch zone for `lane` (bottom half of the screen, GDD §4). */
export function touchZoneRect(layout: Layout, lane: number): TouchZone {
  const w = touchZoneWidth(layout);
  return { x: lane * w, y: layout.touchZoneTop, width: w, height: layout.height - layout.touchZoneTop };
}

/** True when every touch zone is at least MIN_TOUCH_ZONE_PX wide (320 px / 6 lanes = 53 px still passes). */
export function touchZonesComfortable(layout: Layout): boolean {
  return touchZoneWidth(layout) >= MIN_TOUCH_ZONE_PX;
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
