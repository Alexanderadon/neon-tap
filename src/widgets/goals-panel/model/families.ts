import { dict, fmt } from '@/shared/i18n';
import { GOALS, claimedGoalCount, goalProgress, isGoalDone, type Goal, type GoalFamily, type SaveData } from '@/entities/progress';

/** One family of achievements as a ladder: which tier is next and how far along it is. */
export interface FamilyLadder {
  family: GoalFamily;
  tiers: readonly Goal[];
  /** Tiers already reached (0..tiers.length). */
  done: number;
  /** The next tier to earn; undefined when the family is complete. */
  next?: Goal;
  /** Progress towards `next`, clamped to its target (the last tier's target when complete). */
  value: number;
  target: number;
  /** 0..1 towards the next tier (1 when complete). */
  ratio: number;
}

/** Families in catalog order — the ladders the achievements screen shows. */
export function familyLadders(save: SaveData): FamilyLadder[] {
  const byFamily = new Map<GoalFamily, Goal[]>();
  for (const g of GOALS) {
    const list = byFamily.get(g.family);
    if (list) list.push(g);
    else byFamily.set(g.family, [g]);
  }
  return [...byFamily.entries()].map(([family, tiers]) => {
    const done = tiers.filter((g) => isGoalDone(g, save)).length;
    const next = tiers[done];
    const last = tiers[tiers.length - 1];
    const value = next ? goalProgress(next, save) : last.target;
    const target = next ? next.target : last.target;
    return { family, tiers, done, next, value, target, ratio: target > 0 ? value / target : 1 };
  });
}

/** The order a child reads them: the closest next tier first; complete families sink to the bottom. */
export function orderLadders(ladders: readonly FamilyLadder[]): FamilyLadder[] {
  return [...ladders].sort((a, b) => {
    const ca = a.next ? 0 : 1;
    const cb = b.next ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return b.ratio - a.ratio;
  });
}

/** «получено 29 из 97» for the sub-header (retired tiers still in the save are not counted). */
export function goalsGotLine(claimed: readonly string[]): string {
  return fmt(dict.goalsGot, { done: claimedGoalCount(claimed), total: GOALS.length });
}
