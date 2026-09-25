import { dict, fmt, plural } from '@/shared/i18n';
import { rankIndex, starsForTrack, totalStars, type SaveData } from './SaveData';

/**
 * Achievements: 97 badges in 15 families, each family a ladder of tiers ("Комбо 50 → 100 → …").
 * They are evaluated from the save (bests + lifetime counters) after every run; a newly reached
 * tier is claimed once and pays crystals. Stars are never granted here — the unlock thresholds
 * compare against track stars + daily bonuses only, so a badge can never unlock a track by itself.
 */
export type GoalFamily = keyof typeof dict.achievements;

export interface Goal {
  id: string;
  family: GoalFamily;
  tier: number;
  title: string;
  description: string;
  /** Progress value at which the badge is earned. */
  target: number;
  /** Crystals granted once on completion. */
  reward: number;
  /** Raw progress from the save (unclamped). */
  progress: (save: SaveData) => number;
}

const passed = (save: SaveData) => Object.values(save.tracks).filter((b) => starsForTrack(b) > 0).length;
const rankS = (save: SaveData) => Object.values(save.tracks).filter((b) => rankIndex(b.rank) >= rankIndex('S')).length;
const fullCombos = (save: SaveData) => Object.values(save.tracks).filter((b) => b.fullCombo).length;
/** Stars from tracks and daily bonuses. */
const earnedStars = (save: SaveData) => totalStars(save) + save.daily.total;

interface Family {
  family: GoalFamily;
  targets: readonly number[];
  progress: (save: SaveData) => number;
  /** Crystals for tier k (1-based). */
  reward: (tier: number) => number;
}

const linear = (base: number, step: number) => (tier: number) => base + step * (tier - 1);

// Fixed targets (they do not follow the catalog size); the rewards add up to exactly 2 000 crystals.
const FAMILIES: readonly Family[] = [
  { family: 'pass', targets: [1, 3, 5, 10, 20, 30, 40, 50], progress: passed, reward: linear(5, 5) },
  { family: 'combo', targets: [25, 50, 100, 150, 200, 300, 500, 1000], progress: (s) => s.counters.maxCombo, reward: linear(5, 5) },
  { family: 'rankS', targets: [1, 3, 5, 10, 20, 30, 40, 50], progress: rankS, reward: linear(10, 5) },
  { family: 'fullCombo', targets: [1, 3, 5, 10, 20, 30], progress: fullCombos, reward: linear(10, 5) },
  { family: 'stars', targets: [5, 10, 20, 35, 50, 75, 100, 150, 177], progress: earnedStars, reward: linear(5, 5) },
  { family: 'slow', targets: [5, 10, 25, 50, 100, 200], progress: (s) => s.counters.spells.slow, reward: linear(5, 5) },
  { family: 'heart', targets: [5, 10, 25, 50, 100, 200], progress: (s) => s.counters.spells.heart, reward: linear(5, 5) },
  // Earned crystals only: bought ones never reach the lifetime total.
  { family: 'crystals', targets: [50, 100, 250, 500, 1000, 2500, 5000], progress: (s) => s.lifetimeCrystals, reward: linear(5, 5) },
  { family: 'daily', targets: [1, 3, 7, 14, 30], progress: (s) => s.daily.total, reward: linear(10, 5) },
  { family: 'hardest', targets: [2, 3, 4, 5, 6], progress: (s) => s.counters.maxTrackStars, reward: linear(5, 5) },
  { family: 'genres', targets: [2, 4, 6, 8, 10, 14, 18], progress: (s) => s.counters.genres.length, reward: linear(5, 5) },
  // Purchases for crystals only: free unlocks (an ad, NEON PASS) do not count.
  { family: 'bought', targets: [1, 2, 3, 5, 6], progress: (s) => s.counters.bought, reward: linear(10, 5) },
  { family: 'perfects', targets: [100, 500, 1000, 2500, 5000, 10000, 25000], progress: (s) => s.counters.perfects, reward: linear(5, 5) },
  { family: 'attempts', targets: [10, 25, 50, 100, 250, 500], progress: (s) => s.plays, reward: linear(5, 5) },
  { family: 'custom', targets: [1, 5, 10, 25], progress: (s) => s.counters.customPlays, reward: linear(5, 5) },
];

/** All 97 badges, family by family, tiers ascending. */
export const GOALS: readonly Goal[] = FAMILIES.flatMap((f) =>
  f.targets.map((target, i) => {
    const tier = i + 1;
    const text: { title: string; desc: string; noun?: readonly [string, string, string] } = dict.achievements[f.family];
    const noun = text.noun ? plural(target, text.noun) : '';
    return {
      id: `${f.family}-${target}`,
      family: f.family,
      tier,
      title: fmt(text.title, { n: target, noun }),
      description: fmt(text.desc, { n: target }),
      target,
      reward: f.reward(tier),
      progress: f.progress,
    };
  }),
);

export function findGoal(id: string): Goal | undefined {
  return GOALS.find((g) => g.id === id);
}

/**
 * Badges of today's list among the claimed ids («получено N из 97»). `goalsClaimed` also keeps the
 * ids of retired tiers (pass-59, rankS-45, …): they stay in the save so a rollback never pays them
 * twice, but they are not counted.
 */
export function claimedGoalCount(claimed: readonly string[]): number {
  const ids = new Set(claimed);
  return GOALS.filter((g) => ids.has(g.id)).length;
}

/** Progress clamped to [0, target]. */
export function goalProgress(goal: Goal, save: SaveData): number {
  return Math.max(0, Math.min(goal.target, goal.progress(save)));
}

export function isGoalDone(goal: Goal, save: SaveData): boolean {
  return goal.progress(save) >= goal.target;
}

/** Bonus stars on top of track stars: daily completions (badges pay crystals, not stars). */
export function bonusStars(save: SaveData): number {
  return save.daily.total;
}

/** Everything the player has: track stars (optionally limited to `trackIds`) + bonuses. */
export function grandTotalStars(save: SaveData, trackIds?: readonly string[]): number {
  return totalStars(save, trackIds) + bonusStars(save);
}

/** Claim every badge that is complete but not yet claimed, crediting its crystals. Idempotent. */
export function claimGoals(save: SaveData): { save: SaveData; claimed: Goal[] } {
  const claimed = GOALS.filter((g) => !save.goalsClaimed.includes(g.id) && isGoalDone(g, save));
  if (claimed.length === 0) return { save, claimed };
  const reward = claimed.reduce((sum, g) => sum + g.reward, 0);
  return {
    save: {
      ...save,
      goalsClaimed: [...save.goalsClaimed, ...claimed.map((g) => g.id)],
      crystals: save.crystals + reward,
      lifetimeCrystals: save.lifetimeCrystals + reward,
    },
    claimed,
  };
}

/** The next unearned tier of every family — what the profile shows first. */
export function nextGoals(save: SaveData): Goal[] {
  const out: Goal[] = [];
  for (const f of FAMILIES) {
    const next = GOALS.find((g) => g.family === f.family && !isGoalDone(g, save));
    if (next) out.push(next);
  }
  return out;
}
