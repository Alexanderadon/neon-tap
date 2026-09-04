import type { WorldId } from '@/shared/types/world';

export interface World {
  id: WorldId;
  /** Stars needed to unlock. */
  requiredStars: number;
  /** Star range of its tracks, for the map subtitle. */
  starRange: [number, number];
  color: string;
}

/** Progression per GDD §3: 4 worlds, thresholds 0 / 8 / 20 / 38 stars. */
export const WORLDS: readonly World[] = [
  { id: 'launch', requiredStars: 0, starRange: [1, 3], color: '#00f0ff' },
  { id: 'pulse', requiredStars: 8, starRange: [3, 5], color: '#ff2bd6' },
  { id: 'overload', requiredStars: 20, starRange: [5, 7], color: '#b6ff00' },
  { id: 'core', requiredStars: 38, starRange: [7, 10], color: '#ff8a00' },
];

export function isWorldUnlocked(world: World, stars: number): boolean {
  return stars >= world.requiredStars;
}

/** The next locked world (Zeigarnik progress bar target), or null when everything is open. */
export function nextLockedWorld(stars: number): World | null {
  return WORLDS.find((w) => !isWorldUnlocked(w, stars)) ?? null;
}
