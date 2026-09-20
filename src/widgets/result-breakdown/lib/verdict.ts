import { dict, fmt, plural } from '@/shared/i18n';
import type { PlayResult } from '@/entities/score';

export type VerdictKind = 'failed' | 'crowns' | 'stars' | 'no-miss' | 'record' | 'all' | 'two' | 'one' | 'none';

export interface Verdict {
  kind: VerdictKind;
  /** Sentence case; the screen sets it in caps. ≤ 14 characters (spec §2.7). */
  text: string;
}

interface Meta {
  newRecord: boolean;
  starsBefore: number;
  starsAfter: number;
}

/** Stars this run added to the track's record (0 for custom songs and failed runs). */
export function starsGained(meta: Meta | null | undefined): number {
  return meta ? Math.max(0, meta.starsAfter - meta.starsBefore) : 0;
}

/**
 * The one line that says what the run meant, in this order: fail → stars added to the record →
 * no misses → new score record → the level reached (all three / two / one star).
 */
export function verdictOf(result: Pick<PlayResult, 'failed' | 'stars' | 'fullCombo'> & { crowns?: number }, meta: Meta | null | undefined): Verdict {
  if (result.failed) return { kind: 'failed', text: dict.failed };
  // Endless loops past three stars: the crowns come first, they are the run's whole point.
  const crowns = result.crowns ?? 0;
  if (crowns > 0) return { kind: 'crowns', text: fmt(dict.verdictCrowns, { n: crowns, noun: plural(crowns, dict.crownNoun) }) };
  const gained = starsGained(meta);
  if (gained > 0) return { kind: 'stars', text: fmt(dict.verdictStars, { n: gained, noun: plural(gained, dict.starNoun) }) };
  if (result.fullCombo && result.stars > 0) return { kind: 'no-miss', text: dict.verdictNoMiss };
  if (meta?.newRecord) return { kind: 'record', text: dict.verdictRecord };
  if (result.stars >= 3) return { kind: 'all', text: dict.verdictAllStars };
  if (result.stars === 2) return { kind: 'two', text: dict.verdictTwoStars };
  if (result.stars === 1) return { kind: 'one', text: dict.verdictOneStar };
  return { kind: 'none', text: dict.verdictNoStars };
}
