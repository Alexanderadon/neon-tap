import { now } from '@/shared/lib/time';
import { CATALOG, DROPS, DROP_SCHEDULE, emptyNextWeek } from '@/entities/track';

/** Where the non-track cards sit in a deck of `tracks` catalog cards. */
export interface DeckLayout {
  /** «Новые треки — по понедельникам» (the next week has no track), or -1 when not shown. */
  slotCard: number;
  /** «+ Своя музыка», always the last card. */
  customCard: number;
  /** Cards in the deck. */
  size: number;
}

/** Tracks first, then the empty-week card when there is one, then the custom card. */
export function deckLayout(tracks: number, slotWeek: number | null): DeckLayout {
  const slotCard = slotWeek === null ? -1 : tracks;
  const customCard = tracks + (slotWeek === null ? 0 : 1);
  return { slotCard, customCard, size: customCard + 1 };
}

/** The next week to open when it has no track yet (taken at page load, like the catalog), else null. */
export const SLOT_WEEK: number | null = emptyNextWeek(now(), DROP_SCHEDULE, DROPS);

const LAYOUT = deckLayout(CATALOG.length, SLOT_WEEK);

/** The empty-week card «Новые треки — по понедельникам» after the weekly tracks; -1 when the next week has a track or the schedule is over. */
export const SLOT_CARD = LAYOUT.slotCard;

/** The deck's last card, after the last track (and the empty-week card): «+ Своя музыка» (leads to the song-drop-zone screen). */
export const CUSTOM_CARD = LAYOUT.customCard;

/** Cards in the deck: every catalog track, the empty-week card when shown, then the custom card. */
export const DECK_SIZE = LAYOUT.size;

export const isCustomCard = (index: number): boolean => index === CUSTOM_CARD;

export const isSlotCard = (index: number): boolean => SLOT_CARD >= 0 && index === SLOT_CARD;

/** The procedural cover seed of the empty-week card: a stable picture per week. */
export const slotCoverId = (week: number): string => `drop-week-${week}`;

/** The catalog track a deck index stands for — the non-track cards (and anything past them) fall back to the last track. */
export const trackIndexOf = (index: number): number => Math.max(0, Math.min(CATALOG.length - 1, index));
