import type { ChartFile, NoteKind, NoteTuple } from '@/shared/types/chart';
import type { SongMapSegment } from '../lib/Renderer';

/** Beats in a phrase: four bars of four. */
export const BEATS_PER_PHRASE = 16;
/** Never more phrases than this (a 20-minute song at 200 BPM is still under it). */
const MAX_PHRASES = 512;

type ChartGrid = Pick<ChartFile, 'beats' | 'bpm' | 'offset'> & { chart: { notes: readonly NoteTuple[] } };

/**
 * The HUD's song map: the song in 4-bar phrases, each rated by how many hits it asks for — the
 * densest quarter of the phrases is the drop (2), the sparsest quarter the quiet parts (0), the rest 1.
 * Density is what the player will feel under the thumbs; the chart's own loudness levels would paint
 * most of a loud song as one long drop. Positions are fractions of the played span `start`..`endTime` —
 * what the head runs on (a level whose long intro is skipped starts at `start`, and the phrase it
 * starts in begins there). A song without a beat grid, or one that is flat all through, gets one plain segment.
 */
export function songMap(chart: ChartGrid, endTime: number, start = 0): SongMapSegment[] {
  const flat: SongMapSegment[] = [{ from: 0, level: 1 }];
  const span = endTime - start;
  if (!(endTime > 0) || !(span > 0)) return flat;
  const all = phraseStarts(chart, endTime);
  let first = 0;
  while (first + 1 < all.length && all[first + 1] <= start) first++;
  const starts = all.slice(first).map((t, p) => (p === 0 ? start : t));
  if (starts.length < 3) return flat;
  const hits = starts.map(() => 0);
  for (const note of chart.chart.notes) {
    const n: readonly (number | NoteKind | undefined)[] = note;
    const t = n[0] as number;
    if (t < start || t >= endTime) continue;
    let p = 0;
    while (p + 1 < starts.length && starts[p + 1] <= t) p++;
    hits[p] += n[3] === 'roll' ? Math.max(1, (n[4] as number | undefined) ?? 1) : 1;
  }
  // Hits per second — the last phrase may be cut short by the song's end.
  const density = hits.map((k, p) => k / Math.max(0.5, (p + 1 < starts.length ? starts[p + 1] : endTime) - starts[p]));
  // The quarter of the phrases at each end (at least one phrase; ties join in).
  const sorted = [...density].sort((a, b) => a - b);
  const quarter = Math.max(1, Math.round(sorted.length / 4));
  const lo = sorted[quarter - 1];
  const hi = sorted[sorted.length - quarter];
  const levels = density.map((d): 0 | 1 | 2 => (d >= hi && d > lo ? 2 : d <= lo && d < hi ? 0 : 1));
  if (levels.every((l) => l === levels[0])) return flat;
  return starts.map((t, p) => ({ from: (t - start) / span, level: levels[p] }));
}

/** One beat in seconds — from the beat grid when the chart has one, else from the tempo (0.5 s when it has neither). */
export function beatSeconds(chart: Pick<ChartGrid, 'beats' | 'bpm'>): number {
  const beats = chart.beats ?? [];
  if (beats.length >= 2) return (beats[beats.length - 1] - beats[0]) / (beats.length - 1);
  return chart.bpm > 0 ? 60 / chart.bpm : 0.5;
}

/** Where each phrase starts, in seconds, up to `endTime`; the first phrase always starts at 0. */
function phraseStarts(chart: ChartGrid, endTime: number): number[] {
  const beats = chart.beats ?? [];
  let beatAt: (i: number) => number;
  if (beats.length >= 2) {
    const beatSec = beatSeconds(chart);
    beatAt = (i) => (i < beats.length ? beats[i] : beats[beats.length - 1] + (i - beats.length + 1) * beatSec);
  } else if (chart.bpm > 0) {
    const beatSec = 60 / chart.bpm;
    const offset = chart.offset;
    beatAt = (i) => offset + i * beatSec;
  } else return [];
  const starts: number[] = [];
  for (let p = 0; p < MAX_PHRASES; p++) {
    const t = beatAt(p * BEATS_PER_PHRASE);
    if (t >= endTime) break;
    starts.push(p === 0 ? 0 : Math.max(0, t));
  }
  return starts;
}
