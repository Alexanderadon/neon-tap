/** Judgement windows in seconds (GDD §4). Outside `good` → miss. */
export const HIT_WINDOWS = { perfect: 0.05, great: 0.1, good: 0.15 } as const;

/** Default lane count; sections of a chart may switch between MIN_LANES and MAX_LANES. */
export const LANE_COUNT = 4;
export const MIN_LANES = 2;
export const MAX_LANES = 6;

/** Neon palette per lane index: cyan / magenta / lime / orange / violet / yellow. */
export const LANE_COLORS = ['#00f0ff', '#ff2bd6', '#b6ff00', '#ff8a00', '#b56bff', '#ffe600'] as const;

/**
 * Keyboard layouts per lane count. Both hands stay on D F / J K; extra lanes add Space (middle)
 * and S / L (outer). Arrow keys mirror the 4-lane layout.
 */
export const KEY_LAYOUTS: Record<number, Record<string, number>> = {
  2: { KeyF: 0, KeyJ: 1, KeyD: 0, KeyK: 1, KeyS: 0, KeyL: 1, ArrowLeft: 0, ArrowRight: 1, ArrowDown: 0, ArrowUp: 1 },
  3: { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 2, KeyS: 0, KeyL: 2, Space: 1, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 1, ArrowRight: 2 },
  4: { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, KeyS: 0, KeyL: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 },
  5: { KeyD: 0, KeyF: 1, Space: 2, KeyJ: 3, KeyK: 4, KeyS: 0, KeyL: 4, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 3, ArrowRight: 4 },
  6: { KeyS: 0, KeyD: 1, KeyF: 2, KeyJ: 3, KeyK: 4, KeyL: 5, ArrowLeft: 1, ArrowDown: 2, ArrowUp: 3, ArrowRight: 4 },
};

/** Key caps shown under the receptors, per lane count. */
export const KEY_LABELS: Record<number, readonly string[]> = {
  2: ['F', 'J'],
  3: ['D', 'F', 'J'],
  4: ['D', 'F', 'J', 'K'],
  5: ['D', 'F', '␣', 'J', 'K'],
  6: ['S', 'D', 'F', 'J', 'K', 'L'],
};

/** Legacy 4-lane bindings (kept for the calibration screen and tests). */
export const KEY_BINDINGS: Record<string, number> = KEY_LAYOUTS[4];

/** Seconds a note needs to travel the full lane at scroll speed 1.0×. */
export const BASE_APPROACH_TIME = 1.9;

export const SCROLL_SPEED_RANGE = { min: 1, max: 3, step: 0.1 } as const;
export const OFFSET_RANGE_MS = { min: -300, max: 300 } as const;

export const COMBO_THRESHOLDS = [
  { combo: 500, color: '#ffffff' },
  { combo: 250, color: '#ffd700' },
  { combo: 100, color: '#b56bff' },
  { combo: 50, color: '#00f0ff' },
] as const;

export const JUDGEMENT_SCORE = { perfect: 300, great: 200, good: 100, miss: 0 } as const;

export const RANK_THRESHOLDS = [
  { rank: 'SS', min: 1 },
  { rank: 'S', min: 0.95 },
  { rank: 'A', min: 0.9 },
  { rank: 'B', min: 0.8 },
  { rank: 'C', min: 0.7 },
  { rank: 'D', min: 0 },
] as const;

export const CALIBRATION_BPM = 120;
/** Bump to force every player through calibration again (v2: mobile audio was silent before, offsets were garbage). */
export const CALIBRATION_VERSION = 2;
export const CALIBRATION_TAPS = 16;

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Progression gate. `true` = every world and track is playable from the start (current state, by
 * the author's request while the game is tuned); flip to `false` to restore the star thresholds.
 */
export const UNLOCK_ALL_WORLDS = true;

/** Max notes per second per difficulty (GDD §4, autogenerator step 8). */
export const DENSITY_LIMIT: Record<Difficulty, number> = { easy: 2, normal: 4, hard: 7 };
