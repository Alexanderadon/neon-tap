import { dict, fmt, plural } from '@/shared/i18n';

export type LootTone = 'cy' | 'gd' | 'white';

/** One coin of the loot row: value («+35»), what it is, and which currency it pays into. */
export interface LootCoin {
  key: 'crystals' | 'stars' | 'goals' | 'daily' | 'none';
  tone: LootTone;
  /** Signed amount; 0 shows as «+0». */
  amount: number;
  caption: string;
}

export interface Loot {
  coins: readonly [LootCoin, LootCoin, LootCoin];
  /** What the wallet chips grow by once the loot has flown in. */
  crystalsDelta: number;
  starsDelta: number;
}

export interface LootInput {
  /** Crystals collected in the run. */
  crystals: number;
  /** Stars added to the track record. */
  starsGained: number;
  /** Today's daily track completed for the first time (+1 bonus star). */
  dailyBonus: boolean;
  /** Achievements completed by this run: their titles and crystal rewards. */
  goals: readonly { title: string; reward: number }[];
}

/** «+35» / «+0» — the loot is never negative. */
export function formatLoot(amount: number): string {
  return `+${Math.max(0, Math.round(amount))}`;
}

/**
 * Three coins, always three (one height per row): crystals · stars · the third is the achievement
 * («+50 · Комбо 100», several → «+80 · 2 достижения»), else the daily bonus star, else an empty «+0».
 */
export function lootOf(input: LootInput): Loot {
  const crystals = Math.max(0, input.crystals);
  const stars = Math.max(0, input.starsGained);
  const goalCrystals = input.goals.reduce((sum, g) => sum + Math.max(0, g.reward), 0);
  let third: LootCoin;
  if (input.goals.length > 0) {
    const caption =
      input.goals.length === 1 ? input.goals[0].title : fmt(dict.coinGoals, { n: input.goals.length, noun: plural(input.goals.length, dict.goalsNoun) });
    third = { key: 'goals', tone: 'cy', amount: goalCrystals, caption };
  } else if (input.dailyBonus) {
    third = { key: 'daily', tone: 'gd', amount: 1, caption: dict.coinDaily };
  } else {
    third = { key: 'none', tone: 'white', amount: 0, caption: dict.coinBonus };
  }
  return {
    coins: [
      { key: 'crystals', tone: 'cy', amount: crystals, caption: dict.coinCrystals },
      { key: 'stars', tone: 'gd', amount: stars, caption: dict.coinStars },
      third,
    ],
    crystalsDelta: crystals + goalCrystals,
    starsDelta: stars + (input.dailyBonus ? 1 : 0),
  };
}

/** Which coins send icons to the wallet: crystal coins with a value fly three, star coins fly two. */
export function flightsOf(loot: Loot): Array<{ coin: number; kind: 'crystal' | 'star'; count: number }> {
  const out: Array<{ coin: number; kind: 'crystal' | 'star'; count: number }> = [];
  loot.coins.forEach((c, i) => {
    if (c.amount <= 0) return;
    if (c.tone === 'cy') out.push({ coin: i, kind: 'crystal', count: i === 0 ? 3 : 2 });
    else if (c.tone === 'gd') out.push({ coin: i, kind: 'star', count: i === 1 ? 2 : 1 });
  });
  return out;
}
