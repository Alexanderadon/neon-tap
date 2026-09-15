import type { AvatarId } from '@/shared/config/avatars';
import { avatarArtUrl } from './catalogue';

/** Whether the art file of an avatar exists: not asked yet, loaded, or missing (the placeholder is drawn). */
export type ArtState = 'unknown' | 'present' | 'missing';

/** Resolves true when the image at `url` loads. Injectable so the cache is testable without a browser. */
export type ArtLoader = (url: string) => Promise<boolean>;

export interface ArtCache {
  state(id: AvatarId): ArtState;
  /** Probe once per id; later calls return the same promise / the cached answer. */
  probe(id: AvatarId): Promise<boolean>;
  /** Notified when a probe settles. */
  subscribe(listener: () => void): () => void;
}

/** The browser loader: an `Image()` load; outside the browser (tests, SSR) every file is missing. */
export const imageLoader: ArtLoader = (url) =>
  new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = url;
  });

/** A cache of "does `public/avatars/<id>.webp` exist" answers: one network probe per id for the life of the page. */
export function createArtCache(load: ArtLoader = imageLoader, url: (id: AvatarId) => string = avatarArtUrl): ArtCache {
  const states = new Map<AvatarId, ArtState>();
  const pending = new Map<AvatarId, Promise<boolean>>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    state: (id) => states.get(id) ?? 'unknown',
    probe(id) {
      const known = states.get(id);
      if (known === 'present') return Promise.resolve(true);
      if (known === 'missing') return Promise.resolve(false);
      let p = pending.get(id);
      if (!p) {
        p = load(url(id))
          .catch(() => false)
          .then((ok) => {
            states.set(id, ok ? 'present' : 'missing');
            pending.delete(id);
            emit();
            return ok;
          });
        pending.set(id, p);
      }
      return p;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app-wide cache. */
export const artCache: ArtCache = createArtCache();
