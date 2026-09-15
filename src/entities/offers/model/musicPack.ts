import { MUSIC_PACK_SIZE } from './catalogue';

/** The slice of a catalog entry the pack needs (the track entity's `TrackMeta` fits). */
export interface PackTrack {
  id: string;
  stars: number;
  premium?: boolean;
}

/**
 * The eight tracks of the music pack, derived from the catalog: the premium ones first (dearest
 * first), then — when fewer than `size` are premium — the most expensive star-locked tracks fill
 * the pack. The price function is injected (`entities/progress` owns `trackPrice`), so the entity
 * stays free of its siblings. Deterministic for a given catalog.
 */
export function musicPack<T extends PackTrack>(tracks: readonly T[], priceOf: (stars: number, premium: boolean) => number, size = MUSIC_PACK_SIZE): T[] {
  const byPrice = (a: T, b: T) => priceOf(b.stars, b.premium === true) - priceOf(a.stars, a.premium === true);
  const premium = tracks.filter((t) => t.premium === true).sort(byPrice);
  const rest = tracks.filter((t) => t.premium !== true).sort(byPrice);
  return [...premium, ...rest].slice(0, Math.max(0, size));
}

/** What the pack would cost in crystals, track by track. */
export function packValue(tracks: readonly PackTrack[], priceOf: (stars: number, premium: boolean) => number): number {
  return tracks.reduce((sum, t) => sum + priceOf(t.stars, t.premium === true), 0);
}

/** Whether every track of the pack is owned already (then the offer has nothing left to sell). */
export function packOwned(tracks: readonly PackTrack[], purchased: readonly string[]): boolean {
  return tracks.length > 0 && tracks.every((t) => purchased.includes(t.id));
}
