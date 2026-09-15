import { describe, expect, it } from 'vitest';
import { flightsOf, formatLoot, lootOf } from './loot';

describe('lootOf', () => {
  it('always yields three coins: crystals, stars and an empty «+0» bonus', () => {
    const loot = lootOf({ crystals: 35, starsGained: 2, dailyBonus: false, goals: [] });
    expect(loot.coins.map((c) => [c.key, c.tone, c.amount])).toEqual([
      ['crystals', 'cy', 35],
      ['stars', 'gd', 2],
      ['none', 'white', 0],
    ]);
    expect(loot.coins[2].caption).toBe('бонус');
    expect(loot.crystalsDelta).toBe(35);
    expect(loot.starsDelta).toBe(2);
  });

  it('puts the achievement into the third coin and adds its crystals to the wallet delta', () => {
    const loot = lootOf({ crystals: 35, starsGained: 2, dailyBonus: true, goals: [{ title: 'Комбо 100', reward: 50 }] });
    expect(loot.coins[2]).toEqual({ key: 'goals', tone: 'cy', amount: 50, caption: 'Комбо 100' });
    expect(loot.crystalsDelta).toBe(85);
    // the daily star still counts in the wallet even when the coin shows the achievement
    expect(loot.starsDelta).toBe(3);
  });

  it('replaces an achievement title wider than the coin with the generic caption', () => {
    const loot = lootOf({ crystals: 0, starsGained: 0, dailyBonus: false, goals: [{ title: 'Пройди 1 трек', reward: 25 }] });
    expect(loot.coins[2]).toEqual({ key: 'goals', tone: 'cy', amount: 25, caption: 'достижение' });
  });

  it('counts several achievements in one coin', () => {
    const loot = lootOf({
      crystals: 0,
      starsGained: 0,
      dailyBonus: false,
      goals: [
        { title: 'a', reward: 10 },
        { title: 'b', reward: 20 },
      ],
    });
    expect(loot.coins[2]).toMatchObject({ amount: 30, caption: '2 достижения' });
  });

  it('shows the daily bonus star when there is no achievement', () => {
    const loot = lootOf({ crystals: 0, starsGained: 1, dailyBonus: true, goals: [] });
    expect(loot.coins[2]).toEqual({ key: 'daily', tone: 'gd', amount: 1, caption: 'трек дня' });
    expect(loot.starsDelta).toBe(2);
  });

  it('never goes negative', () => {
    const loot = lootOf({ crystals: -5, starsGained: -1, dailyBonus: false, goals: [{ title: 'x', reward: -3 }] });
    expect(loot.coins.map((c) => c.amount)).toEqual([0, 0, 0]);
    expect(loot.crystalsDelta).toBe(0);
    expect(formatLoot(-2)).toBe('+0');
    expect(formatLoot(35)).toBe('+35');
  });
});

describe('flightsOf', () => {
  it('flies three crystals from the first coin, two stars from the second, fewer from the third', () => {
    const loot = lootOf({ crystals: 35, starsGained: 2, dailyBonus: false, goals: [{ title: 'x', reward: 50 }] });
    expect(flightsOf(loot)).toEqual([
      { coin: 0, kind: 'crystal', count: 3 },
      { coin: 1, kind: 'star', count: 2 },
      { coin: 2, kind: 'crystal', count: 2 },
    ]);
  });

  it('empty coins send nothing', () => {
    expect(flightsOf(lootOf({ crystals: 0, starsGained: 0, dailyBonus: false, goals: [] }))).toEqual([]);
    expect(flightsOf(lootOf({ crystals: 0, starsGained: 0, dailyBonus: true, goals: [] }))).toEqual([{ coin: 2, kind: 'star', count: 1 }]);
  });
});
