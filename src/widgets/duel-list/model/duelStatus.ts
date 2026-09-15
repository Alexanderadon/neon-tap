import type { Duel } from '@/shared/api/duels';
import { duelVerdict } from '@/entities/duel';

/** What the host sees on a duel row: still loading, gone, no answers yet, everyone behind, or someone beat the score. */
export type DuelStatus = 'loading' | 'closed' | 'waiting' | 'ahead' | 'beaten';

export function duelStatus(duel: Duel | null | undefined): DuelStatus {
  if (duel === undefined) return 'loading';
  if (duel === null) return 'closed';
  if (duel.replies.length === 0) return 'waiting';
  return duel.replies.some((r) => duelVerdict(duel.host, r) === 'beaten') ? 'beaten' : 'ahead';
}

/** «3 вызова · 3 ответа» — how many duels were hosted and how many answers came back. */
export function duelSummary(loaded: Readonly<Record<string, Duel | null>>, ids: readonly string[]): { calls: number; answers: number } {
  let answers = 0;
  for (const id of ids) answers += loaded[id]?.replies.length ?? 0;
  return { calls: ids.length, answers };
}
