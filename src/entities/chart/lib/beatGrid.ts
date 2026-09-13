import { clamp } from '@/shared/lib/math';

/** Sixteenths per beat: the grid every tile sits on. */
export const GRID_PER_BEAT = 4;

/** Beat index (fractional allowed) → song seconds on a tracked beat grid; extrapolates past the ends. */
export function beatTime(beats: readonly number[], beat: number): number {
  if (!Number.isFinite(beat)) return beat;
  if (beats.length === 0) return beat;
  if (beats.length === 1) return beats[0] + beat * 0.5;
  const i = clamp(Math.floor(beat), 0, beats.length - 2);
  const step = beats[i + 1] - beats[i];
  return beats[i] + (beat - i) * step;
}

/** Song seconds → fractional beat index on the grid (inverse of `beatTime`, same extrapolation). */
export function beatIndex(beats: readonly number[], time: number): number {
  if (!Number.isFinite(time)) return time;
  if (beats.length === 0) return time;
  if (beats.length === 1) return (time - beats[0]) / 0.5;
  let i = 0;
  while (i < beats.length - 2 && beats[i + 1] <= time) i++;
  const step = beats[i + 1] - beats[i];
  return i + (time - beats[i]) / step;
}

/** Song time of grid slot `slot` (sixteenths from the first beat; negative before it), to the millisecond. */
export function slotTime(beats: readonly number[], slot: number): number {
  return Math.round(beatTime(beats, slot / GRID_PER_BEAT) * 1000) / 1000;
}

/** Nearest sixteenth of the grid to `time`: its slot index and its song time. */
export function snapToGrid(beats: readonly number[], time: number): { slot: number; time: number } {
  const slot = Math.round(beatIndex(beats, time) * GRID_PER_BEAT);
  return { slot, time: slotTime(beats, slot) };
}
