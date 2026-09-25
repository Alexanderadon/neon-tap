import { audioEngine } from '@/shared/lib/audio';
import { navigate } from '@/shared/lib/router';
import type { ChartFile } from '@/shared/types/chart';
import { loadSongData, touchPlayed } from '@/entities/custom-song';
import { clearActiveDuel } from '@/entities/duel';
import { sessionStore, startSession } from '@/entities/play-session';

export type PlayCustomOutcome = 'ok' | 'missing' | 'failed';

interface PlayDeps {
  /** Decode the stored file (the audio engine by default). */
  decode?: (data: ArrayBuffer) => Promise<AudioBuffer>;
  /** Open the game (navigate by default). */
  go?: () => void;
}

/**
 * Let go of the decoded song kept for the last run on an own song (≈21–23 MB per stereo minute,
 * up to ≈280 MB for 12 minutes): at most one decoded song stays in memory.
 */
export function releaseSongBuffer(): void {
  if (sessionStore.get().audioBuffer) sessionStore.set({ audioBuffer: null });
}

/**
 * Play a saved song: a plain run (not a duel answer) → free the previous buffer → read the chart
 * and the file → decode → start the session → remember the play → the game. No second analysis:
 * the chart was saved with the song. `missing` when it is gone (deleted in another tab).
 */
export async function playCustomSong(id: string, deps: PlayDeps = {}): Promise<PlayCustomOutcome> {
  // The audio context is resumed while the tap's gesture is still current (iOS), before any await.
  const context = deps.decode ? null : audioEngine.ensureContext().catch(() => undefined);
  const decode =
    deps.decode ??
    (async (bytes: ArrayBuffer) => {
      await context;
      return audioEngine.decode(bytes);
    });
  clearActiveDuel();
  releaseSongBuffer();
  let data;
  try {
    data = await loadSongData(id);
  } catch (err) {
    console.error(err);
    return 'failed';
  }
  if (!data) return 'missing';
  let buffer: AudioBuffer;
  try {
    buffer = await decode(await data.audio.arrayBuffer());
  } catch (err) {
    console.error(err);
    return 'failed';
  }
  startSession(data.chart, 'custom', buffer);
  touchPlayed(id);
  (deps.go ?? (() => navigate('game')))();
  return 'ok';
}

/** Play a song that was just generated (its buffer is decoded already); `saved` marks it played in the list. */
export function playGeneratedSong(chart: ChartFile, buffer: AudioBuffer, saved: boolean, go: () => void = () => navigate('game')): void {
  clearActiveDuel();
  startSession(chart, 'custom', buffer);
  if (saved) touchPlayed(chart.id);
  go();
}
