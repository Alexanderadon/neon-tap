import type { ReactNode } from 'react';
import { isAvatarId } from '@/shared/config/avatars';
import { AvatarArt } from './AvatarArt';

/**
 * The `art` prop of an `Avatar` for a saved choice: the picture for a known id, `undefined` for ''
 * or an unknown id (the sphere then shows the letter). One line at every call site.
 */
export function avatarArtOf(id: string | undefined | null): ReactNode | undefined {
  return isAvatarId(id) ? <AvatarArt id={id} /> : undefined;
}
