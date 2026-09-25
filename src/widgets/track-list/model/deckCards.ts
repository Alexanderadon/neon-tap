import { CATALOG } from '@/entities/track';

/** The deck's last card, after the last pack track: «+ Своя музыка» (leads to the song-drop-zone screen). */
export const CUSTOM_CARD = CATALOG.length;

/** Cards in the deck: every catalog track, then the custom card. */
export const DECK_SIZE = CATALOG.length + 1;

export const isCustomCard = (index: number): boolean => index === CUSTOM_CARD;

/** The catalog track a deck index stands for — the custom card (and anything past it) falls back to the last track. */
export const trackIndexOf = (index: number): number => Math.max(0, Math.min(CATALOG.length - 1, index));
