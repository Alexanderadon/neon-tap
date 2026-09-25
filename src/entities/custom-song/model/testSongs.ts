import type { ChartFile } from '@/shared/types/chart';
import { newSong } from './song';
import type { NewSong } from './types';

/** A small saved song for tests (`bytes` sets the audio size). */
export function testSong(id: string, over: { title?: string; artist?: string; stars?: number; createdAt?: number; bytes?: number } = {}): NewSong {
  const chart: ChartFile = {
    id,
    title: over.title ?? id,
    artist: over.artist ?? '',
    license: 'user file (local only)',
    sourceUrl: '',
    audio: '',
    bpm: 120,
    offset: 0,
    duration: 90,
    chart: { stars: over.stars ?? 3, notes: [[1, 0]] },
  };
  return newSong({
    id,
    chart,
    audio: new Blob([new Uint8Array(over.bytes ?? 16)]),
    title: over.title ?? id,
    artist: over.artist ?? '',
    generatorVersion: 1,
    createdAt: over.createdAt ?? 0,
  });
}
