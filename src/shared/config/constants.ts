/** Judgement windows in seconds (GDD §4). Outside `good` → miss. */
export const HIT_WINDOWS = { perfect: 0.045, great: 0.09, good: 0.135 } as const;

export const LANE_COUNT = 4;

/** Neon palette per lane: cyan / magenta / lime / orange. */
export const LANE_COLORS = ['#00f0ff', '#ff2bd6', '#b6ff00', '#ff8a00'] as const;

export const KEY_BINDINGS: Record<string, number> = {
  KeyD: 0,
  KeyF: 1,
  KeyJ: 2,
  KeyK: 3,
  ArrowLeft: 0,
  ArrowDown: 1,
  ArrowUp: 2,
  ArrowRight: 3,
};

/** Seconds a note needs to travel the full lane at scroll speed 1.0×. */
export const BASE_APPROACH_TIME = 1.6;

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
export const CALIBRATION_TAPS = 16;

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Max notes per second per difficulty (GDD §4, autogenerator step 8). */
export const DENSITY_LIMIT: Record<Difficulty, number> = { easy: 3, normal: 6, hard: 10 };
