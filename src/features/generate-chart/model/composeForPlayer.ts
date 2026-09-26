import { composeChart, type ComposeTrace, type SongAnalysis } from '@/shared/lib/analysis';
import type { ChartLevel } from '@/shared/types/chart';

/** How an own song's chart is fitted to the player (see `skillStars`). */
export interface PlayerFit {
  /** The player's ceiling: the chart never goes above it; the song's own energy may pick lower. */
  maxStars?: number;
  /** An exact ★, over the energy and the ceiling (the song sheet's «Сложнее»). */
  targetStars?: number;
}

export interface FittedChart {
  chart: ChartLevel;
  /** Phrase levels per phrase (the composer's trace), kept with the chart. */
  phrases: number[];
}

/**
 * Compose an own song for this player. The song's energy picks its ★ as for any song (chapter
 * `'normal'`); when that is above the player's ceiling, the chart is composed again under the
 * ceiling — a steady 120 BPM beat no longer lands a newcomer on ★5. An explicit `targetStars`
 * composes straight at that ★.
 */
export function composeForPlayer(analysis: SongAnalysis, fit: PlayerFit = {}): FittedChart {
  const box: { trace?: ComposeTrace } = {};
  const onTrace = (t: ComposeTrace) => (box.trace = t);
  if (fit.targetStars !== undefined) {
    const chart = composeChart(analysis, { targetStars: fit.targetStars, onTrace });
    return { chart, phrases: box.trace?.levels ?? [] };
  }
  let chart = composeChart(analysis, { onTrace });
  // Without an override the trace's target is the energy's own pick.
  const energyStars = box.trace?.target ?? chart.stars;
  if (fit.maxStars !== undefined && energyStars > fit.maxStars) chart = composeChart(analysis, { targetStars: fit.maxStars, onTrace });
  return { chart, phrases: box.trace?.levels ?? [] };
}
