/**
 * The game is designed for portrait on phones (full-width lanes, touch zones in the bottom half).
 * A phone held in landscape gives a viewport too short for the note runway, so we ask to rotate.
 * Tablets and laptops with touchscreens are not affected: their landscape height is ≥ 500 px.
 */
export const SHORT_VIEWPORT_PX = 500;

/** True when a touch device is in landscape with a short viewport — show the "rotate" hint. */
export function needsRotateHint(touch: boolean, width: number, height: number): boolean {
  return touch && width > height && height < SHORT_VIEWPORT_PX;
}
