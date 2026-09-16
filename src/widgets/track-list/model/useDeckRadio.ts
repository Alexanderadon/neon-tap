import { useEffect, useRef } from 'react';
import { audioEngine, useAudioUnlocked } from '@/shared/lib/audio';

/** The radio's loudness relative to the game's music volume. */
export const RADIO_LEVEL = 0.12;
/** The radio starts a third of the way into the song (past the intro), like the shop preview. */
const RADIO_AT = 1 / 3;
/** The deck must rest on a card this long before its song starts (a flick across cards plays nothing). */
const SETTLE_MS = 450;
/** Decoded songs kept for flipping back and forth. */
const KEEP = 4;

const buffers = new Map<string, AudioBuffer>();
async function load(id: string): Promise<AudioBuffer> {
  const hit = buffers.get(id);
  if (hit) {
    buffers.delete(id);
    buffers.set(id, hit);
    return hit;
  }
  const buffer = await audioEngine.loadUrl(`${import.meta.env.BASE_URL}music/${id}.mp3`);
  buffers.set(id, buffer);
  while (buffers.size > KEEP) buffers.delete(buffers.keys().next().value!);
  return buffer;
}

/**
 * The menu radio: the focused track plays quietly (RADIO_LEVEL of the music volume) from a third in,
 * looping, and follows the deck once it settles on a card. Silent until audio is unlocked by a
 * gesture; stops (fading) when `enabled` turns false or the page unmounts. Anything that starts the
 * real music (`audioEngine.play` / `preview`) cuts it on its own.
 */
export function useDeckRadio(trackId: string | undefined, enabled: boolean): void {
  const unlocked = useAudioUnlocked();
  const token = useRef(0);
  const playing = useRef<string | null>(null);
  useEffect(() => {
    const on = enabled && unlocked && !!trackId;
    if (!on) {
      token.current++;
      if (playing.current) {
        playing.current = null;
        audioEngine.stopAmbient();
      }
      return;
    }
    if (playing.current === trackId) return;
    const my = ++token.current;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const buffer = await load(trackId);
          if (my !== token.current) return;
          playing.current = trackId;
          audioEngine.ambient(buffer, buffer.duration * RADIO_AT, RADIO_LEVEL);
        } catch {
          // The song did not load (network): the deck stays silent for this card.
        }
      })();
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [trackId, enabled, unlocked]);
  useEffect(
    () => () => {
      token.current++;
      if (playing.current) {
        playing.current = null;
        audioEngine.stopAmbient();
      }
    },
    [],
  );
}
