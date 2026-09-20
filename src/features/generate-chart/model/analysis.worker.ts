/// <reference lib="webworker" />
import { analyzeSong, composeChart } from '@/shared/lib/analysis';
import type { ChartLevel } from '@/shared/types/chart';

export interface AnalysisRequest {
  samples: Float32Array;
  sampleRate: number;
}

export type AnalysisStage = 'onsets' | 'beats' | 'grid' | 'charts';

export type AnalysisMessage =
  | { type: 'progress'; stage: AnalysisStage; fraction: number }
  | { type: 'done'; bpm: number; offset: number; beats: number[]; phrases: number[]; onsets: number; confidence: number; chart: ChartLevel }
  | { type: 'error'; message: string };

const post = (m: AnalysisMessage) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<AnalysisRequest>) => {
  try {
    const { samples, sampleRate } = e.data;
    const analysis = analyzeSong(samples, sampleRate, (stage, fraction) => post({ type: 'progress', stage, fraction }));
    post({ type: 'progress', stage: 'charts', fraction: 0 });
    let phrases: number[] = [];
    const chart = composeChart(analysis, { onTrace: (t) => (phrases = t.levels) });
    post({
      type: 'done',
      bpm: analysis.bpm,
      offset: analysis.beats[0] ?? 0,
      beats: analysis.beats,
      phrases,
      onsets: analysis.onsetCount,
      confidence: analysis.confidence,
      chart,
    });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
