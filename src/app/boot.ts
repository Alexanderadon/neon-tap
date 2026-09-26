import { audioEngine, loadSong, preloadSfx, prefetchSong } from '@/shared/lib/audio';
import { getSettings } from '@/entities/settings';
import { CATALOG, idsAround, loadChart, preloadCover } from '@/entities/track';
import { progressStore } from '@/entities/progress';
import { voice } from '@/features/voice-feedback';
import { buildCatalogState, initialDeckIndex, trackIndexOf } from '@/widgets/track-list';

/**
 * The longest the splash waits. A game's loading screen may take a while on a slow line — the bar
 * shows it moving — but it must never hold the game forever: past the cap the game opens and the
 * rest keeps loading in the background.
 */
const BOOT_CAP_MS = 30_000;
/** The font gets this long (it is served with the game, but a stalled request must not hold the whole game). */
const FONT_CAP_MS = 4_000;
/** Songs prefetched (bytes only, into the browser cache) after the splash: the cards right after the first one. */
const PREFETCH_NEXT = 2;
/** The tutorial's chart id (public/charts/tutorial.json, pages/tutorial). */
const TUTORIAL_CHART = 'tutorial';

/**
 * One boot task: its promise, its share of the bar (≈ megabytes it downloads) and, for a long
 * download, how far it has come (0..1).
 */
interface Task {
  promise: Promise<unknown>;
  weight: number;
  progress?: (listener: (fraction: number) => void) => void;
}

/** A song and its chart, decoded into the shared song cache — the first run then starts without a loading bar. */
function songTask(chartId: string, weight: number): Task {
  const listeners = new Set<(fraction: number) => void>();
  const promise = loadChart(chartId).then((chart) =>
    loadSong(`${import.meta.env.BASE_URL}${chart.audio}`, { onProgress: (f) => listeners.forEach((l) => l(f)) }),
  );
  return { promise, weight, progress: (l) => listeners.add(l) };
}

/** The card the deck opens on (the nearest track on a card without one). */
function startTrackIndex(): number {
  try {
    return trackIndexOf(initialDeckIndex(buildCatalogState(progressStore.get()), typeof localStorage === 'undefined' ? null : localStorage));
  } catch {
    return 0; // storage blocked: the deck opens on its default card
  }
}

/**
 * Everything needed to play at once, loaded behind the splash like a game's loading bar: the font,
 * the sound effects and the voice (decoded now, so the first tap already sounds), EVERY track cover
 * (the nearest first — no empty card on any swipe), the song and chart of the card the deck opens
 * on (PLAY starts at once, the menu radio has it too), and on a first launch the tutorial's song as
 * well (a player may skip the tutorial and go straight to a track). After the splash the next
 * cards' songs are fetched quietly. `onProgress` gets 0..1 weighted by size; never rejects.
 */
export function bootAssets(onProgress: (fraction: number) => void): Promise<void> {
  const settings = getSettings();
  audioEngine.setVolumes({ music: settings.musicVolume, sfx: settings.sfxVolume, voice: settings.voiceVolume });
  voice.setVoice(settings.voice);
  const ids = CATALOG.map((t) => t.id);
  const at = startTrackIndex();
  const tasks: Task[] = [
    { promise: fontsReady(), weight: 0.2 },
    { promise: preloadSfx(), weight: 0.2 },
    { promise: voice.preload(), weight: 0.3 },
    ...(ids[at] ? [songTask(ids[at], 3.5)] : []),
    ...(settings.tutorialDone ? [] : [songTask(TUTORIAL_CHART, 2.3)]),
    ...idsAround(ids, at, ids.length).map((id) => ({ promise: preloadCover(id), weight: 0.1 })),
  ];
  const total = tasks.reduce((sum, t) => sum + t.weight, 0);
  const partial = tasks.map(() => 0);
  const report = () => onProgress(tasks.reduce((sum, t, i) => sum + t.weight * partial[i], 0) / total);
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
  ).then(() => {
    // The splash is gone: the songs of the next cards come quietly into the browser cache.
    for (const id of ids.slice(at + 1, at + 1 + PREFETCH_NEXT)) {
      void loadChart(id)
        .then((chart) => prefetchSong(`${import.meta.env.BASE_URL}${chart.audio}`))
        .catch(() => undefined);
    }
  });
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
