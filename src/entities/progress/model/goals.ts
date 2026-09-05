import { dict } from '@/shared/i18n';
import { rankIndex, starsForTrack, totalStars, type SaveData } from './SaveData';

export type GoalId = keyof typeof dict.goals;

export interface Goal {
  id: GoalId;
  title: string;
  description: string;
  /** Progress value at which the goal completes. */
  target: number;
  /** Bonus stars granted once on completion. */
  reward: number;
  /** Raw progress from the save (unclamped). */
  progress: (save: SaveData) => number;
}

const passed = (save: SaveData) => Object.values(save.tracks).filter((b) => starsForTrack(b) > 0).length;
const rankS = (save: SaveData) => Object.values(save.tracks).filter((b) => rankIndex(b.rank) >= rankIndex('S')).length;
const fullCombos = (save: SaveData) => Object.values(save.tracks).filter((b) => b.fullCombo).length;
/** Stars from tracks and daily bonuses — goal rewards are excluded so a goal never feeds itself. */
const earnedStars = (save: SaveData) => totalStars(save) + save.daily.total;

function goal(id: GoalId, target: number, reward: number, progress: (save: SaveData) => number): Goal {
  return { id, title: dict.goals[id].title, description: dict.goals[id].desc, target, reward, progress };
}

/** Fixed quest list, evaluated from save data + lifetime counters (GDD §1, Zeigarnik). */
export const GOALS: readonly Goal[] = [
  goal('pass-5', 5, 2, passed),
  goal('full-combo', 1, 2, fullCombos),
  goal('combo-100', 100, 2, (s) => s.counters.maxCombo),
  goal('slow-10', 10, 2, (s) => s.counters.spells.slow),
  goal('star-6', 6, 2, (s) => s.counters.maxTrackStars),
  goal('daily-3', 3, 3, (s) => s.daily.total),
  goal('stars-20', 20, 3, earnedStars),
  goal('rank-s-3', 3, 3, rankS),
];

export function findGoal(id: string): Goal | undefined {
  return GOALS.find((g) => g.id === id);
}

/** Progress clamped to [0, target]. */
export function goalProgress(goal: Goal, save: SaveData): number {
  return Math.max(0, Math.min(goal.target, goal.progress(save)));
}

export function isGoalDone(goal: Goal, save: SaveData): boolean {
  return goal.progress(save) >= goal.target;
}

/** Reward stars of every claimed goal. */
export function goalStars(save: SaveData): number {
  let sum = 0;
  for (const id of save.goalsClaimed) sum += findGoal(id)?.reward ?? 0;
  return sum;
}

/** Bonus stars on top of track stars: daily completions + claimed goal rewards. */
export function bonusStars(save: SaveData): number {
  return save.daily.total + goalStars(save);
}

/** Everything the player has: track stars (optionally limited to `trackIds`) + bonuses. */
export function grandTotalStars(save: SaveData, trackIds?: readonly string[]): number {
  return totalStars(save, trackIds) + bonusStars(save);
}

/** Grant rewards for goals that are complete but not yet claimed. Idempotent. */
export function claimGoals(save: SaveData): { save: SaveData; claimed: Goal[] } {
  const claimed = GOALS.filter((g) => !save.goalsClaimed.includes(g.id) && isGoalDone(g, save));
  if (claimed.length === 0) return { save, claimed };
  return { save: { ...save, goalsClaimed: [...save.goalsClaimed, ...claimed.map((g) => g.id)] }, claimed };
}
