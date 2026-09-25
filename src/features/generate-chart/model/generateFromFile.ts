import { audioEngine } from '@/shared/lib/audio';
import type { ChartFile } from '@/shared/types/chart';
import type { AnalysisMessage, AnalysisRequest, AnalysisStage } from './analysis.worker';

export type GenerateStage = 'decode' | AnalysisStage;

export interface GenerateProgress {
  stage: GenerateStage;
  /** 0..1 within the stage. */
  fraction: number;
}

export interface GeneratedSong {
  chart: ChartFile;
  audioBuffer: AudioBuffer;
  onsets: number;
  confidence: number;
}

/**
 * The chart generator's version, stored with every saved song. Bump it when the analysis or the
 * composer changes the charts it makes, so old songs can be told apart (and regenerated later).
 */
export const GENERATOR_VERSION = 1;

/** Who the song is: the id (its file's fingerprint, see entities/custom-song) and the names shown. */
export interface SongIdentity {
  id: string;
  title: string;
  artist: string;
}

/** Analysis sample rate: enough for onsets up to 11 kHz, 2× faster than 44.1 kHz. */
const ANALYSIS_RATE = 22050;

/** Beat-tracking confidence below this, or fewer notes per second than `WEAK_DENSITY`, reads as a weak rhythm. */
const WEAK_CONFIDENCE = 0.1;
const WEAK_DENSITY = 0.4;

/** The rhythm was hard to find (ambient, speech, a very free tempo): the level may feel loose. The song is still playable and saved. */
export function isWeakRhythm(song: { confidence: number; chart: ChartFile }): boolean {
  const duration = song.chart.duration;
  const density = duration > 0 ? song.chart.chart.notes.length / duration : 0;
  return song.confidence < WEAK_CONFIDENCE || density < WEAK_DENSITY;
}

/** Mono mixdown, downsampled by simple decimation with a box filter (good enough for flux). */
function mixdown(buffer: AudioBuffer): { samples: Float32Array; sampleRate: number } {
  const channels = buffer.numberOfChannels;
  const ratio = Math.max(1, Math.floor(buffer.sampleRate / ANALYSIS_RATE));
  const outRate = buffer.sampleRate / ratio;
  const outLen = Math.floor(buffer.length / ratio);
  const out = new Float32Array(outLen);
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));
  for (let i = 0; i < outLen; i++) {
    let acc = 0;
    const base = i * ratio;
    for (let k = 0; k < ratio; k++) for (let c = 0; c < channels; c++) acc += data[c][base + k];
    out[i] = acc / (ratio * channels);
  }
  return { samples: out, sampleRate: outRate };
}

/** Decode a user's audio file in the AudioContext (the first stage of `generateFromFile`). */
export async function decodeSongFile(file: Blob, onProgress: (p: GenerateProgress) => void): Promise<AudioBuffer> {
  onProgress({ stage: 'decode', fraction: 0 });
  const audioBuffer = await audioEngine.decode(await file.arrayBuffer());
  onProgress({ stage: 'decode', fraction: 1 });
  return audioBuffer;
}

/** Build a playable chart from decoded audio in a Worker (the analysis stages of `generateFromFile`). */
export async function chartFromBuffer(audioBuffer: AudioBuffer, song: SongIdentity, onProgress: (p: GenerateProgress) => void): Promise<GeneratedSong> {
  const { samples, sampleRate } = mixdown(audioBuffer);
  const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
  try {
    const done = await new Promise<Extract<AnalysisMessage, { type: 'done' }>>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<AnalysisMessage>) => {
        const m = e.data;
        if (m.type === 'progress') onProgress({ stage: m.stage, fraction: m.fraction });
        else if (m.type === 'done') resolve(m);
        else reject(new Error(m.message));
      };
      worker.onerror = (e) => reject(new Error(e.message));
      const req: AnalysisRequest = { samples, sampleRate };
      worker.postMessage(req, [samples.buffer]);
    });
    const chart: ChartFile = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      license: 'user file (local only)',
      sourceUrl: '',
      audio: '',
      bpm: done.bpm,
      offset: done.offset,
      duration: audioBuffer.duration,
      beats: done.beats,
      phrases: done.phrases,
      chart: done.chart,
    };
    return { chart, audioBuffer, onsets: done.onsets, confidence: done.confidence };
  } finally {
    worker.terminate();
  }
}

/**
 * Decode a user's audio file and build a playable chart entirely in the browser.
 * The file is never uploaded anywhere — decoding happens in the AudioContext, analysis in a Worker.
 * The id and names come from outside (the song catalog fingerprints the file and reads its tags);
 * without them the file name is the title and the id is session-only.
 */
export async function generateFromFile(file: File, onProgress: (p: GenerateProgress) => void, song?: SongIdentity): Promise<GeneratedSong> {
  const audioBuffer = await decodeSongFile(file, onProgress);
  const title = file.name.replace(/\.[^.]+$/, '');
  return chartFromBuffer(audioBuffer, song ?? { id: `custom:${title}:${file.size}`, title, artist: '' }, onProgress);
}
