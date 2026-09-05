import type { Judgement, Rank } from '@/entities/score';

/** Judgement tick colours: miss magenta, good lime, great cyan, perfect white (same as the breakdown rows). */
export const JUDGEMENT_COLORS: Record<Judgement, string> = {
  perfect: '#ffffff',
  great: '#00f0ff',
  good: '#b6ff00',
  miss: '#ff2bd6',
};

/** Rank colours mirrored from the track-list CSS (`.rank-*`) for the canvas share card. */
export const RANK_COLORS: Record<Rank, string> = {
  SS: '#ffd700',
  S: '#ffd700',
  A: '#00f0ff',
  B: '#b6ff00',
  C: '#ff8a00',
  D: '#ff2bd6',
};

const LANE_BAND: Record<number, string> = { 2: '#b56bff', 3: '#00f0ff', 4: '#b6ff00', 5: '#ff8a00', 6: '#ff2bd6' };

/** Colour of a lane-count section band under the song strip. */
export function laneBandColor(lanes: number): string {
  return LANE_BAND[lanes] ?? '#ffffff';
}

export const FONT_DISPLAY = "'Unbounded', 'Segoe UI', system-ui, sans-serif";
export const BG_COLOR = '#05060a';
