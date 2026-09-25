export { GameSession, MAX_HEARTS } from './model/GameSession';
export type { SessionEvent, SessionOptions } from './model/GameSession';
export { NoteManager, NoteState } from './model/NoteManager';
export type { PooledNote, JudgeEvent } from './model/NoteManager';
export { Lives } from './model/Lives';
export { pickGems, pickLoopGems, gemTotal, isGemCandidate, BIG_GEM_VALUE, GEM_MIN_TIME, LOOP_GEM_COUNT } from './model/gems';
export type { GemPick } from './model/gems';
export { LEVELS } from './model/levels';
// The second chance: only what the canvas host (widgets/game-canvas) drives it with; the rest stays inside the feature.
export { reviveStep, REVIVE_IDLE, REVIVE_OFFER_SEC, REFILL_AT, reviveAvailable, reviveArmed, reviveKeysLocked, watchReviveAd } from './model/revive';
export type { ReviveState, ReviveAction } from './model/revive';
