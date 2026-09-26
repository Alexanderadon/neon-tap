import { useEffect, useRef, useState } from 'react';
import { audioEngine, cancelBackgroundLoad, loadSong, useAudioUnlocked } from '@/shared/lib/audio';

/** The radio's loudness relative to the game's music volume. */
export const RADIO_LEVEL = 0.12;
/** The radio starts a third of the way into the song (past the intro), like the shop preview. */
const RADIO_AT = 1 / 3;
/** The deck must rest on a card this long before its song starts downloading (a flick across cards plays and loads nothing). */
export const RADIO_SETTLE_MS = 900;

const songUrl = (id: string) => `${import.meta.env.BASE_URL}music/${id}.mp3`;

/** The focused card's song through the shared cache: when PLAY is pressed on it, the game finds it decoded. */
function load(id: string): Promise<AudioBuffer> {
  return loadSong(songUrl(id), { background: true });
}

/** The browser's data saver is on (`navigator.connection.saveData`, Chrome / Android): the radio would spend megabytes on a whim. */
export function saveDataOn(nav: unknown = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  const connection = (nav as { connection?: { saveData?: unknown } } | undefined)?.connection;
  return connection?.saveData === true;
}

/** The page is visible (true outside a browser: tests). */
const pageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * The menu radio: the focused track plays quietly (RADIO_LEVEL of the music volume) from a third in,
 * looping, and follows the deck once it has rested on a card for RADIO_SETTLE_MS. Silent until audio
 * is unlocked by a gesture, and always with the data saver on. Moving to another card drops the
 * previous card's download if it is still running. When the page goes to the background (another
 * app, a locked phone, the Yandex Games tab hidden) the radio stops at once and the audio context
 * sleeps; the next gesture resumes it and the radio comes back. Stops (fading) when `enabled` turns
 * false or the page unmounts. Anything that starts the real music (`audioEngine.play` / `preview`)
 * cuts it on its own.
 */
export function useDeckRadio(trackId: string | undefined, enabled: boolean): void {
  const unlocked = useAudioUnlocked();
  const [visible, setVisible] = useState(pageVisible);
  const token = useRef(0);
  const playing = useRef<string | null>(null);
  /** The card whose song the radio is downloading (null once it has arrived or failed). */
  const loading = useRef<string | null>(null);

  // Background: silence now, the context asleep; back in front, the radio resumes after the next gesture.
  useEffect(() => {
    const hide = () => {
      token.current++;
      playing.current = null;
      audioEngine.stopAmbient(0);
      audioEngine.suspend();
      setVisible(false);
    };
    const onVisibility = () => (pageVisible() ? setVisible(true) : hide());
    const onPageShow = () => setVisible(pageVisible());
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  useEffect(() => {
    const on = enabled && unlocked && visible && !!trackId && !saveDataOn();
    if (!on) {
      token.current++;
      if (playing.current) {
        playing.current = null;
        audioEngine.stopAmbient();
      }
      return;
    }
    if (playing.current === trackId) return;
    // Another card: the last card's song stops taking the bandwidth (a load the game now waits for is kept).
    if (loading.current && loading.current !== trackId) {
      cancelBackgroundLoad(songUrl(loading.current));
      loading.current = null;
    }
    const my = ++token.current;
    const timer = setTimeout(() => {
      void (async () => {
        loading.current = trackId;
        try {
          const buffer = await load(trackId);
          if (loading.current === trackId) loading.current = null;
          if (my !== token.current) return;
          playing.current = trackId;
          audioEngine.ambient(buffer, buffer.duration * RADIO_AT, RADIO_LEVEL);
        } catch {
          // The song did not load (network, or cancelled for another card): the deck stays silent for this card.
          if (loading.current === trackId) loading.current = null;
        }
      })();
    }, RADIO_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [trackId, enabled, unlocked, visible]);

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
