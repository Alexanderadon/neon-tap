import { audioEngine, preloadSfx } from '@/shared/lib/audio';
import { getSettings } from '@/entities/settings';
import { CATALOG, idsAround, loadChart, preloadCover } from '@/entities/track';
import { progressStore } from '@/entities/progress';
import { voice } from '@/features/voice-feedback';
import { buildCatalogState, initialDeckIndex } from '@/widgets/track-list';

/** The longest the splash waits; past it the game opens with whatever has arrived. */
const BOOT_CAP_MS = 10_000;
/** The font gets this long (a slow CDN must not hold the whole game). */
const FONT_CAP_MS = 4_000;
/** Pictures ready before the menu shows: the card the deck opens on and two on each side. */
const BOOT_COVERS = 2;

/**
 * Everything the first screen needs, loaded behind the splash like a game's loading bar: the font,
 * the sound effects and the voice (decoded now, so the first tap already sounds), the pictures
 * around the card the deck opens on, and that card's chart. The rest of the pictures follow in the
 * background (the deck keeps them ahead of the player); songs load when a track is chosen.
 * `onProgress` gets 0..1; the promise never rejects.
 */
export function bootAssets(onProgress: (fraction: number) => void): Promise<void> {
  const settings = getSettings();
  audioEngine.setVolumes({ music: settings.musicVolume, sfx: settings.sfxVolume, voice: settings.voiceVolume });
  voice.setVoice(settings.voice);
  const ids = CATALOG.map((t) => t.id);
  let at = 0;
  try {
    at = initialDeckIndex(buildCatalogState(progressStore.get()), typeof localStorage === 'undefined' ? null : localStorage);
  } catch {
    // Storage blocked: the deck opens on its default card, the first pictures are still worth having.
  }
  const tasks: Promise<unknown>[] = [
    fontsReady(),
    preloadSfx(),
    voice.preload(),
    ids[at] ? loadChart(ids[at]) : Promise.resolve(),
    ...idsAround(ids, at, BOOT_COVERS).map((id) => preloadCover(id)),
  ];
  let done = 0;
  onProgress(0);
  const all = Promise.all(
    tasks.map((t) =>
      t
        .catch(() => undefined)
        .then(() => {
          done++;
          onProgress(done / tasks.length);
        }),
    ),
  );
  return Promise.race([all.then(() => undefined), new Promise<void>((resolve) => setTimeout(resolve, BOOT_CAP_MS))]);
}

/** The three weights of the UI font, or the cap. */
function fontsReady(): Promise<unknown> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const loads = ['400 16px Unbounded', '700 16px Unbounded', '900 16px Unbounded'].map((f) => document.fonts.load(f).catch(() => undefined));
  return Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, FONT_CAP_MS))]);
}
