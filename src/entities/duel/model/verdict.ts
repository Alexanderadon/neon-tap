import type { DuelRun } from '@/shared/api/duels';

export type DuelVerdict = 'beaten' | 'lost';

/** Did `mine` beat the host? Higher score wins; a tie on score goes to accuracy; a full tie stays with the host. */
export function duelVerdict(host: DuelRun, mine: { score: number; accuracy: number }): DuelVerdict {
  if (mine.score !== host.score) return mine.score > host.score ? 'beaten' : 'lost';
  return mine.accuracy > host.accuracy ? 'beaten' : 'lost';
}
