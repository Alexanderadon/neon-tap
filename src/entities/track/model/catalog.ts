import type { WorldId } from '@/shared/types/world';
import catalogJson from './catalog.json';
import type { TrackMeta } from './types';

export const CATALOG: readonly TrackMeta[] = catalogJson as TrackMeta[];

export const TRACK_IDS: readonly string[] = CATALOG.map((t) => t.id);

export function tracksOfWorld(world: WorldId): TrackMeta[] {
  return CATALOG.filter((t) => t.world === world);
}

export function findTrack(id: string): TrackMeta | undefined {
  return CATALOG.find((t) => t.id === id);
}
