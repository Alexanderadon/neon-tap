export {
  TUTORIAL_PLAN,
  SPELL_LANE,
  REPLAY_STEPS,
  buildScript,
  captionAt,
  stepProgress,
  replayDue,
  beatTime,
  beatIndex,
  keyHint,
  laneKey,
  zoneHint,
} from './model/script';
export type { TutorialStep, TutorialKind, TutorialStepId, TutorialPlanEntry } from './model/script';
export { TUTORIAL_REWARD, completeTutorial } from './model/finale';
export type { TutorialFinaleDeps } from './model/finale';
