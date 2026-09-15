export { AVATARS, AVATAR_IDS, isAvatarId, sanitizeAvatar, avatarMeta, avatarName, avatarArtUrl } from './model/catalogue';
export type { AvatarId, AvatarMeta } from './model/catalogue';
export { artCache, createArtCache, imageLoader } from './model/artCache';
export type { ArtCache, ArtLoader, ArtState } from './model/artCache';
export { AvatarArt } from './ui/AvatarArt';
export { AvatarEmblem } from './ui/AvatarEmblem';
export { avatarArtOf } from './ui/artOf';
