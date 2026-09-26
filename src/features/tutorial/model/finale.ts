/** Crystals for finishing the tutorial the first time (the «+20» coin on the «Готово!» frame). */
export const TUTORIAL_REWARD = 20;

/** Where the finale reads and writes: the settings flag and the progress wallet (injected, so the rule is testable without the stores). */
export interface TutorialFinaleDeps {
  /** `settings.tutorialDone` before this finale. */
  isDone: () => boolean;
  markDone: () => void;
  /** Credit earned crystals (entities/progress `recordCrystals`). */
  credit: (amount: number) => void;
}

/**
 * The run reached the finale: the tutorial is marked done and, the first time only (it was not done
 * before — neither finished nor skipped), TUTORIAL_REWARD crystals are credited. Returns what was
 * credited, 0 on every later finish.
 */
export function completeTutorial(deps: TutorialFinaleDeps): number {
  const first = !deps.isDone();
  deps.markDone();
  if (!first) return 0;
  deps.credit(TUTORIAL_REWARD);
  return TUTORIAL_REWARD;
}
