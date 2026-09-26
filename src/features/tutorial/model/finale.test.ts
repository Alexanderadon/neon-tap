import { describe, expect, it } from 'vitest';
import { TUTORIAL_REWARD, completeTutorial, type TutorialFinaleDeps } from './finale';

/** An in-memory settings flag and wallet. */
function fakeStores(done = false) {
  const state = { done, crystals: 0, credits: 0 };
  const deps: TutorialFinaleDeps = {
    isDone: () => state.done,
    markDone: () => {
      state.done = true;
    },
    credit: (n) => {
      state.crystals += n;
      state.credits++;
    },
  };
  return { state, deps };
}

describe('the tutorial finale', () => {
  it('credits +20 crystals and marks the tutorial done the first time', () => {
    expect(TUTORIAL_REWARD).toBe(20);
    const { state, deps } = fakeStores();
    expect(completeTutorial(deps)).toBe(20);
    expect(state).toEqual({ done: true, crystals: 20, credits: 1 });
  });

  it('credits once: a replay of the tutorial (R, or «Обучение» again later) finishes with nothing', () => {
    const { state, deps } = fakeStores();
    completeTutorial(deps);
    expect(completeTutorial(deps)).toBe(0);
    expect(completeTutorial(deps)).toBe(0);
    expect(state).toEqual({ done: true, crystals: 20, credits: 1 });
  });

  it('pays nothing when the tutorial was already done or skipped before', () => {
    const { state, deps } = fakeStores(true);
    expect(completeTutorial(deps)).toBe(0);
    expect(state).toEqual({ done: true, crystals: 0, credits: 0 });
  });
});
