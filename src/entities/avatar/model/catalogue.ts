import { AVATAR_IDS, isAvatarId, sanitizeAvatar, type AvatarId } from '@/shared/config/avatars';
import { dict } from '@/shared/i18n';

export { AVATAR_IDS, isAvatarId, sanitizeAvatar };
export type { AvatarId };

export interface AvatarMeta {
  id: AvatarId;
  /** The sphere's neon accent (the face of the procedural placeholder; the art files carry their own colours). */
  accent: string;
  /** The underside of that accent (the dark rim at the bottom of the gloss). */
  under: string;
}

/**
 * The twelve avatars (GDD «Аватары»), in picker order: 4 × 3. Each has a distinct hue around the
 * neon wheel so the placeholders read apart at 32 px; the names come from the dictionary.
 */
export const AVATARS: readonly AvatarMeta[] = [
  { id: 'cat', accent: '#00f0ff', under: '#005c66' },
  { id: 'fox', accent: '#ff8a00', under: '#7a3a00' },
  { id: 'robot', accent: '#7c8cff', under: '#2a2f7a' },
  { id: 'astronaut', accent: '#e6f0ff', under: '#4a5570' },
  { id: 'panda', accent: '#b6ff00', under: '#4a6a00' },
  { id: 'alien', accent: '#39ff8a', under: '#0c6a38' },
  { id: 'dragon', accent: '#ff3b3b', under: '#7a0f0f' },
  { id: 'owl', accent: '#ffd700', under: '#7a5a00' },
  { id: 'shark', accent: '#4d8dff', under: '#123a7a' },
  { id: 'bunny', accent: '#ff2bd6', under: '#5a0a48' },
  { id: 'ghost', accent: '#b56bff', under: '#4a1f7a' },
  { id: 'dino', accent: '#2dffb3', under: '#0c6a4a' },
];

const BY_ID: ReadonlyMap<AvatarId, AvatarMeta> = new Map(AVATARS.map((a) => [a.id, a]));

export function avatarMeta(id: AvatarId): AvatarMeta {
  return BY_ID.get(id)!;
}

/** The Russian name («Кот в наушниках»). */
export function avatarName(id: AvatarId): string {
  return dict.avatarNames[id];
}

function baseUrl(): string {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Where the generated art of an avatar lives: `public/avatars/<id>.webp`, served under the app's base. */
export function avatarArtUrl(id: AvatarId, base: string = baseUrl()): string {
  return `${base}avatars/${id}.webp`;
}
