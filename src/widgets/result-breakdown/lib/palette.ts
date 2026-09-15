import type { Judgement, Rank } from '@/entities/score';

/** Judgement tick colours (audit §C13): one grey ramp — white / w80 / w55 — with magenta only for misses. */
export const JUDGEMENT_COLORS: Record<Judgement, string> = {
  perfect: '#ffffff',
  great: '#cccccc',
  good: '#8c8c8c',
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

/** Colour of a lane-count section band under the song strip: the sections alternate two greys (w55 / w30), the number tells the width. */
export function laneBandColor(index: number): string {
  return index % 2 === 0 ? '#8c8c8c' : '#4d4d4d';
}

export const FONT_DISPLAY = "'Unbounded', 'Segoe UI', system-ui, sans-serif";
export const BG_COLOR = '#05060a';
