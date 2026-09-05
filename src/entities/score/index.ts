export { Scoring, judgeDelta, accuracyOf, rankOf, notesToReach, comboMultiplier } from './model/Scoring';
export {
  longestStreak,
  firstMissTime,
  worstWindow,
  runningAccuracy,
  sampleStep,
  comboCurve,
  accuracyCurve,
  densestSlice,
  summarizeTimeline,
  formatClock,
} from './lib/resultStats';
export type { Streak, MissWindow, TimeRange, ResultHighlights } from './lib/resultStats';
export type { Judgement, JudgementCounts, Rank, PlayResult, ResultTimeline } from '@/shared/types/result';
