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

/** Analysis sample rate: enough for onsets up to 11 kHz, 2× faster than 44.1 kHz. */
const ANALYSIS_RATE = 22050;

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

/**
 * Decode a user's audio file and build a playable chart entirely in the browser.
 * The file is never uploaded anywhere — decoding happens in the AudioContext, analysis in a Worker.
 */
export async function generateFromFile(file: File, onProgress: (p: GenerateProgress) => void): Promise<GeneratedSong> {
  onProgress({ stage: 'decode', fraction: 0 });
  const audioBuffer = await audioEngine.decode(await file.arrayBuffer());
  onProgress({ stage: 'decode', fraction: 1 });
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
    const title = file.name.replace(/\.[^.]+$/, '');
    const chart: ChartFile = {
      id: `custom:${title}:${file.size}`,
      title,
      artist: '',
      license: 'user file (local only)',
      sourceUrl: '',
      audio: '',
      bpm: done.bpm,
      offset: done.offset,
      duration: audioBuffer.duration,
      beats: done.beats,
      charts: done.charts,
    };
    return { chart, audioBuffer, onsets: done.onsets, confidence: done.confidence };
  } finally {
    worker.terminate();
  }
}
