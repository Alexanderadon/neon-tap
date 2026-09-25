import { describe, expect, it } from 'vitest';
import { CATALOG, PREMIUM_IDS, TRACK_IDS } from '@/entities/track';
import { ALWAYS_OPEN, isTrackUnlocked, newlyUnlocked, nextUnlock, roadThresholds, unlockStates, unlockThreshold } from './unlocks';

const IDS = Array.from({ length: 21 }, (_, i) => `t${i}`);

describe('unlocks', () => {
  it('keeps the five easiest tracks free and grows the threshold with position', () => {
    for (let i = 0; i < ALWAYS_OPEN; i++) expect(unlockThreshold(i, 21)).toBe(0);
    expect(unlockThreshold(5, 21)).toBe(2); // round(1 × 2.2)
    expect(unlockThreshold(6, 21)).toBe(4);
    expect(unlockThreshold(7, 21)).toBe(7); // round(6.6)
    expect(unlockThreshold(10, 21)).toBe(13);
    expect(unlockThreshold(20, 21)).toBe(35); // round(35.2)
    for (let i = 1; i < 21; i++) expect(unlockThreshold(i, 21)).toBeGreaterThanOrEqual(unlockThreshold(i - 1, 21));
  });

  it('never asks for more than max stars − 6', () => {
    // 21 tracks → 63 stars → cap 57; a huge catalog hits the cap of its own size
    for (let i = 0; i < 21; i++) expect(unlockThreshold(i, 21)).toBeLessThanOrEqual(57);
    expect(unlockThreshold(60, 40)).toBe(40 * 3 - 6);
    expect(unlockThreshold(5, 1)).toBe(0); // cap can't go negative
  });

  it('reports unlock state per track in catalog order', () => {
    const states = unlockStates(IDS, { stars: 4 });
    expect(states.map((s) => s.id)).toEqual(IDS);
    expect(states.slice(0, 7).every((s) => s.unlocked)).toBe(true); // free + need 2 + need 4
    expect(states[7]).toEqual({ id: 't7', unlocked: false, need: 7, premium: false, purchased: false });
    expect(states[20].unlocked).toBe(false);
  });

  it('daily track and custom songs are always open, UNLOCK_ALL opens everything', () => {
    expect(isTrackUnlocked(IDS, 't20', { stars: 0 })).toBe(false);
    expect(isTrackUnlocked(IDS, 't20', { stars: 0, dailyId: 't20' })).toBe(true);
    expect(isTrackUnlocked(IDS, 'my-song.mp3', { stars: 0 })).toBe(true);
    expect(unlockStates(IDS, { stars: 0, unlockAll: true }).every((s) => s.unlocked)).toBe(true);
    expect(unlockStates(IDS, { stars: 0, dailyId: 't15' })[15].unlocked).toBe(true);
    expect(unlockStates(IDS, { stars: 0, dailyId: 't15' })[16].unlocked).toBe(false);
  });

  it('lists tracks that open when stars grow', () => {
    expect(newlyUnlocked(IDS, 0, 0)).toEqual([]);
    expect(newlyUnlocked(IDS, 1, 2)).toEqual(['t5']);
    expect(newlyUnlocked(IDS, 3, 7)).toEqual(['t6', 't7']);
    expect(newlyUnlocked(IDS, 7, 5)).toEqual([]);
  });
});

describe('unlocks — purchased and premium', () => {
  it('a bought track is open regardless of stars', () => {
    expect(isTrackUnlocked(IDS, 't20', { stars: 0 })).toBe(false);
    expect(isTrackUnlocked(IDS, 't20', { stars: 0, purchased: ['t20'] })).toBe(true);
    const states = unlockStates(IDS, { stars: 0, purchased: ['t20', 't7'] });
    expect(states[20]).toMatchObject({ unlocked: true, purchased: true, premium: false });
    expect(states[7]).toMatchObject({ unlocked: true, purchased: true });
    expect(states[8]).toMatchObject({ unlocked: false, purchased: false });
  });

  it('premium tracks never open by stars — only by purchase, unlock-all or as the daily track', () => {
    const ctx = { stars: 999, premium: ['t3', 't15'] };
    expect(isTrackUnlocked(IDS, 't3', ctx)).toBe(false); // inside the free positions, still premium
    expect(isTrackUnlocked(IDS, 't15', ctx)).toBe(false);
    expect(isTrackUnlocked(IDS, 't16', ctx)).toBe(true);
    expect(isTrackUnlocked(IDS, 't15', { ...ctx, purchased: ['t15'] })).toBe(true);
    expect(isTrackUnlocked(IDS, 't15', { ...ctx, unlockAll: true })).toBe(true);
    expect(isTrackUnlocked(IDS, 't15', { ...ctx, dailyId: 't15' })).toBe(true);
    const states = unlockStates(IDS, ctx);
    expect(states[3]).toMatchObject({ id: 't3', unlocked: false, premium: true, purchased: false });
    expect(states.filter((s) => !s.unlocked).map((s) => s.id)).toEqual(['t3', 't15']);
  });

  it('newlyUnlocked skips premium tracks', () => {
    expect(newlyUnlocked(IDS, 3, 7)).toEqual(['t6', 't7']);
    // t6 premium: t7 takes its place on the road (needs 4), t8 needs 7
    expect(newlyUnlocked(IDS, 3, 7, ['t6'])).toEqual(['t7', 't8']);
  });
});

describe('unlocks — the road counts non-premium tracks only', () => {
  it('a premium track does not push the tracks after it further', () => {
    const premium = ['t5', 't6'];
    expect(roadThresholds(IDS, premium).slice(0, 10)).toEqual([0, 0, 0, 0, 0, 0, 0, 2, 4, 7]);
    const states = unlockStates(IDS, { stars: 4, premium });
    expect(states[7]).toMatchObject({ id: 't7', need: 2, unlocked: true });
    expect(states[8]).toMatchObject({ id: 't8', need: 4, unlocked: true });
    expect(states[9]).toMatchObject({ id: 't9', need: 7, unlocked: false });
    // premium tracks need no stars — they never open by stars
    expect(states[5]).toMatchObject({ need: 0, premium: true, unlocked: false });
    expect(isTrackUnlocked(IDS, 't8', { stars: 4, premium })).toBe(true);
    expect(isTrackUnlocked(IDS, 't9', { stars: 4, premium })).toBe(false);
    // the cap follows the road size: 19 road tracks → 57 − 6
    expect(Math.max(...roadThresholds(IDS, premium))).toBeLessThanOrEqual(19 * 3 - 6);
    expect(roadThresholds(IDS)).toEqual(IDS.map((_, i) => unlockThreshold(i, IDS.length)));
  });

  it('on the real catalog: the rock pack opens at 70 / 73 / 75 and no threshold grows', () => {
    const road = CATALOG.filter((t) => TRACK_IDS.includes(t.id));
    const needs = roadThresholds(TRACK_IDS, PREMIUM_IDS);
    const rock = road.filter((t) => t.pack === 'rock').map((t) => needs[TRACK_IDS.indexOf(t.id)]);
    expect(rock).toEqual([70, 73, 75]);
    TRACK_IDS.forEach((id, i) => {
      if (PREMIUM_IDS.includes(id)) return;
      expect(needs[i]).toBeLessThanOrEqual(unlockThreshold(i, TRACK_IDS.length));
    });
    // still easiest first: the road never asks for fewer stars further on
    const roadNeeds = needs.filter((_, i) => !PREMIUM_IDS.includes(TRACK_IDS[i]));
    for (let i = 1; i < roadNeeds.length; i++) expect(roadNeeds[i]).toBeGreaterThanOrEqual(roadNeeds[i - 1]);
  });
});

describe('nextUnlock', () => {
  it('returns the first star-gated track that is still closed, with the stars missing', () => {
    const states = unlockStates(IDS, { stars: 5 });
    expect(nextUnlock(states, 5)).toEqual({ id: 't7', need: 7, have: 5, missing: 2 });
  });

  it('skips premium and bought tracks — they never open by stars', () => {
    const states = unlockStates(IDS, { stars: 5, premium: ['t7'], purchased: ['t8'] });
    // t7 premium moves the road up by one: t8 would need 7 (bought), t9 needs 9
    expect(nextUnlock(states, 5)).toEqual({ id: 't9', need: 9, have: 5, missing: 4 });
  });

  it('is null when every star-gated track is open', () => {
    expect(nextUnlock(unlockStates(IDS, { stars: 0, unlockAll: true }), 0)).toBeNull();
    expect(nextUnlock(unlockStates(IDS, { stars: 999 }), 999)).toBeNull();
    expect(nextUnlock([], 3)).toBeNull();
  });

  it('never reports zero missing stars for a closed track', () => {
    // A daily track is open today without the stars; the one after it is the next unlock.
    const states = unlockStates(IDS, { stars: 4, dailyId: 't7' });
    expect(nextUnlock(states, 4)).toEqual({ id: 't8', need: 9, have: 4, missing: 5 });
  });
});
