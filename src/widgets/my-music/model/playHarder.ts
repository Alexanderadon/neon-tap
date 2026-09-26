import { audioEngine } from '@/shared/lib/audio';
import { loadSongData } from '@/entities/custom-song';
import { chartFromBuffer, decodeSongFile, type GenerateProgress } from '@/features/generate-chart';
import { playGeneratedSong, releaseSongBuffer } from '@/features/play-custom';

/** How «Сложнее» ended: the game opened, the song is gone (another tab), something failed, or the sheet let go meanwhile. */
export type HarderOutcome = 'ok' | 'missing' | 'failed' | 'cancelled';

export interface HarderDeps {
  onProgress: (p: GenerateProgress) => void;
  /** Open the game (the sheet decides: navigate, or let the buffer go when it is gone). */
  go: () => void;
  /** Still wanted (the sheet is open and this is its latest run). */
  live: () => boolean;
}

/**
 * «Сложнее · ★N»: the saved file of an own song is decoded once more and composed at exactly `stars`,
 * then played at once — the same one decoded buffer serves the analysis and the run (the last run's
 * buffer is let go first). The saved chart stays as it is; the record is the song's, as for any run.
 */
export async function playHarder(id: string, stars: number, { onProgress, go, live }: HarderDeps): Promise<HarderOutcome> {
  // The context resumes while the tap's gesture is still current (iOS), before any await.
  const context = audioEngine.ensureContext().catch(() => undefined);
  releaseSongBuffer();
  let data;
  try {
    data = await loadSongData(id);
  } catch (err) {
    console.error(err);
    return 'failed';
  }
  if (!data) return 'missing';
  if (!live()) return 'cancelled';
  try {
    await context;
    const buffer = await decodeSongFile(data.audio, onProgress);
    if (!live()) return 'cancelled';
    const song = await chartFromBuffer(buffer, { id, title: data.meta.title, artist: data.meta.artist }, onProgress, { targetStars: stars });
    if (!live()) return 'cancelled';
    playGeneratedSong(song.chart, buffer, true, go);
    return 'ok';
  } catch (err) {
    console.error(err);
    return 'failed';
  }
}
