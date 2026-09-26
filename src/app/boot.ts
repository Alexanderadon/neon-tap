import { audioEngine, loadSong, preloadSfx } from '@/shared/lib/audio';
import { getSettings } from '@/entities/settings';
import { CATALOG, idsAround, loadChart, preloadCover } from '@/entities/track';
import { progressStore } from '@/entities/progress';
import { voice } from '@/features/voice-feedback';
import { buildCatalogState, initialDeckIndex, trackIndexOf } from '@/widgets/track-list';

/** The longest the splash waits; past it the game opens with whatever has arrived. */
const BOOT_CAP_MS = 10_000;
/** The font gets this long (it is served with the game now, but a stalled request must not hold the whole game). */
const FONT_CAP_MS = 4_000;
/** Pictures ready before the menu shows: the card the deck opens on and two on each side. */
const BOOT_COVERS = 2;
/** The tutorial's chart id (public/charts/tutorial.json, pages/tutorial). */
const TUTORIAL_CHART = 'tutorial';

/** One boot task: its promise and, for a long download, how far it has come (0..1). */
interface Task {
  promise: Promise<unknown>;
  progress?: (listener: (fraction: number) => void) => void;
}

/**
 * The tutorial's chart, then its song, decoded — what a first launch opens straight into (App →
 * firstLaunchStep → the tutorial). Through the same caches the tutorial page and the game read
 * (`loadChart`, `loadSong`), so the first run starts without a loading bar.
 */
function tutorialTask(): Task {
  const listeners = new Set<(fraction: number) => void>();
  const promise = loadChart(TUTORIAL_CHART).then((chart) =>
    loadSong(`${import.meta.env.BASE_URL}${chart.audio}`, { onProgress: (f) => listeners.forEach((l) => l(f)) }),
  );
  return { promise, progress: (l) => listeners.add(l) };
}

/** The pictures around the card the deck opens on, and that card's chart (the nearest track's on a card without one). */
function deckTasks(): Task[] {
  const ids = CATALOG.map((t) => t.id);
  let at = 0;
  try {
    // «Моя музыка» and the empty-week card sit after the tracks: their neighbours are the last covers.
    at = trackIndexOf(initialDeckIndex(buildCatalogState(progressStore.get()), typeof localStorage === 'undefined' ? null : localStorage));
  } catch {
    // Storage blocked: the deck opens on its default card, the first pictures are still worth having.
  }
  return [ids[at] ? loadChart(ids[at]) : Promise.resolve(), ...idsAround(ids, at, BOOT_COVERS).map((id) => preloadCover(id))].map((promise) => ({ promise }));
}

/**
 * Everything the first screen needs, loaded behind the splash like a game's loading bar: the font,
 * the sound effects and the voice (decoded now, so the first tap already sounds), and then either
 * the tutorial's chart and song (a first launch goes straight into the tutorial — no deck to show)
 * or the pictures around the card the deck opens on and that card's chart. The rest of the pictures
 * follow in the background (the deck keeps them ahead of the player); songs load when a track is
 * chosen. `onProgress` gets 0..1 (the tutorial song counts by its download); the promise never rejects.
 */
export function bootAssets(onProgress: (fraction: number) => void): Promise<void> {
  const settings = getSettings();
  audioEngine.setVolumes({ music: settings.musicVolume, sfx: settings.sfxVolume, voice: settings.voiceVolume });
  voice.setVoice(settings.voice);
  const tasks: Task[] = [
    { promise: fontsReady() },
    { promise: preloadSfx() },
    { promise: voice.preload() },
    ...(settings.tutorialDone ? deckTasks() : [tutorialTask()]),
  ];
  const partial = tasks.map(() => 0);
  const report = () => onProgress(partial.reduce((sum, p) => sum + p, 0) / tasks.length);
  onProgress(0);
  const all = Promise.all(
    tasks.map((t, i) => {
      t.progress?.((f) => {
        partial[i] = Math.max(partial[i], Math.min(0.99, f));
        report();
      });
      return t.promise
        .catch(() => undefined)
        .then(() => {
          partial[i] = 1;
          report();
        });
    }),
  );
  return Promise.race([all.then(() => undefined), new Promise<void>((resolve) => setTimeout(resolve, BOOT_CAP_MS))]);
}

/** Text the font check asks for: Latin and Cyrillic, so both subsets (split by unicode-range) are in before the first frame. */
const FONT_PROBE = 'NEON TAP Играть 0123';

/** The three weights of the UI font, or the cap. */
function fontsReady(): Promise<unknown> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const loads = ['400 16px Unbounded', '700 16px Unbounded', '900 16px Unbounded'].map((f) => document.fonts.load(f, FONT_PROBE).catch(() => undefined));
  return Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, FONT_CAP_MS))]);
}
