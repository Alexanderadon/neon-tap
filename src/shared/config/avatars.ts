/**
 * The ids of the chosen avatars (GDD «Аватары»). Only the ids live here, so the settings store
 * can sanitise a saved choice without reaching into `entities/avatar`, where the catalogue (names,
 * colours, art, placeholders) is built on top of this list. The art file of an id is
 * `public/avatars/<id>.webp`.
 */
export const AVATAR_IDS = ['cat', 'fox', 'robot', 'astronaut', 'panda', 'alien', 'dragon', 'owl', 'shark', 'bunny', 'ghost', 'dino'] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatarId(x: unknown): x is AvatarId {
  return typeof x === 'string' && (AVATAR_IDS as readonly string[]).includes(x);
}

/** A saved choice: a known id, or '' (the letter avatar) for anything else — unknown ids from an older or newer build fall back to the letter. */
export function sanitizeAvatar(x: unknown): AvatarId | '' {
  return isAvatarId(x) ? x : '';
}
