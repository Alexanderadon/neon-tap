import { useEffect, useSyncExternalStore } from 'react';
import type { AvatarId } from '@/shared/config/avatars';
import { artCache, type ArtCache } from '../model/artCache';
import { avatarArtUrl } from '../model/catalogue';
import { AvatarEmblem } from './AvatarEmblem';

/** The art state of an avatar, probed once per id (the cache lives for the page). */
function useAvatarArt(id: AvatarId, cache: ArtCache) {
  const state = useSyncExternalStore(
    cache.subscribe,
    () => cache.state(id),
    () => cache.state(id),
  );
  useEffect(() => {
    if (cache.state(id) === 'unknown') void cache.probe(id);
  }, [id, cache]);
  return state;
}

interface Props {
  id: AvatarId;
  /** Injectable for tests; the app uses the shared cache. */
  cache?: ArtCache;
}

/**
 * The picture of an avatar for the `Avatar` sphere's art slot: the `public/avatars/<id>.webp` file
 * when it exists (checked once with an `Image()` load), the procedural emblem otherwise — and
 * while the probe is in flight, so nothing flashes.
 */
export function AvatarArt({ id, cache = artCache }: Props) {
  const state = useAvatarArt(id, cache);
  if (state === 'present') return <img src={avatarArtUrl(id)} alt="" draggable={false} decoding="async" />;
  return <AvatarEmblem id={id} />;
}
