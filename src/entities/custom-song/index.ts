/**
 * The player's own songs («Моя музыка»). Placeholder contract for the parallel packages — the
 * IndexedDB catalog replaces the stub body and keeps these two exports.
 */

/** Saved songs a player without NEON PASS may keep. */
export const CUSTOM_FREE_LIMIT = 3;

/** How many songs are saved on this device (placeholder: none yet). */
export function useSongCount(): number {
  return 0;
}
