import { UNLOCK_ALL_WORLDS } from '@/shared/config/constants';
import type { WorldId } from '@/shared/types/world';

export interface World {
  id: WorldId;
  /** Stars needed to unlock (ignored while UNLOCK_ALL_WORLDS is on). */
  requiredStars: number;
  /** Star range of its tracks, for the map subtitle. */
  starRange: [number, number];
  color: string;
}

/** Progression per GDD §3: 4 worlds, thresholds 0 / 8 / 20 / 38 stars. */
export const WORLDS: readonly World[] = [
  { id: 'launch', requiredStars: 0, starRange: [3, 6], color: '#00f0ff' },
  { id: 'pulse', requiredStars: 8, starRange: [3, 7], color: '#ff2bd6' },
  { id: 'overload', requiredStars: 20, starRange: [3, 8], color: '#b6ff00' },
  { id: 'core', requiredStars: 38, starRange: [3, 9], color: '#ff8a00' },
];

export function isWorldUnlocked(world: World, stars: number): boolean {
  return UNLOCK_ALL_WORLDS || stars >= world.requiredStars;
}

/** The next locked world (Zeigarnik progress bar target), or null when everything is open. */
export function nextLockedWorld(stars: number): World | null {
  return WORLDS.find((w) => !isWorldUnlocked(w, stars)) ?? null;
}
