/// <reference lib="webworker" />
import { detectOnsets, estimateBpm, generateAllDifficulties } from '@/shared/lib/analysis';
import type { ChartLevel } from '@/shared/types/chart';
import type { Difficulty } from '@/shared/config/constants';

export interface AnalysisRequest {
  samples: Float32Array;
  sampleRate: number;
}

export type AnalysisStage = 'onsets' | 'bpm' | 'charts';

export type AnalysisMessage =
  | { type: 'progress'; stage: AnalysisStage; fraction: number }
  | { type: 'done'; bpm: number; offset: number; onsets: number; confidence: number; charts: Record<Difficulty, ChartLevel> }
  | { type: 'error'; message: string };

const post = (m: AnalysisMessage) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<AnalysisRequest>) => {
  try {
    const { samples, sampleRate } = e.data;
    post({ type: 'progress', stage: 'onsets', fraction: 0 });
    const { onsets, flux, hopSeconds } = detectOnsets(samples, {
      sampleRate,
      onProgress: (fraction) => post({ type: 'progress', stage: 'onsets', fraction }),
    });
    post({ type: 'progress', stage: 'bpm', fraction: 0 });
    const est = estimateBpm(flux, hopSeconds);
    post({ type: 'progress', stage: 'charts', fraction: 0 });
    const charts = generateAllDifficulties(onsets, est.bpm, est.offset);
    post({ type: 'done', bpm: est.bpm, offset: est.offset, onsets: onsets.length, confidence: est.confidence, charts });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
