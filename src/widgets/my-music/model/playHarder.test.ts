import { beforeEach, describe, expect, it, vi } from 'vitest';

const log: string[] = [];
const song = { meta: { title: 'Моя песня', artist: 'Я' }, chart: {}, audio: new Blob(['x']) };
let stored: typeof song | null = song;

vi.mock('@/shared/lib/audio', () => ({ audioEngine: { ensureContext: async () => log.push('context') } }));
vi.mock('@/entities/custom-song', () => ({
  loadSongData: async () => (log.push('load'), stored),
  replaceSongChart: async (_id: string, chart: { stars: number }) => (log.push(`save ★${chart.stars}`), true),
}));
vi.mock('@/features/play-custom', () => ({
  releaseSongBuffer: () => log.push('release'),
  playGeneratedSong: (chart: { stars: number }, _buffer: unknown, saved: boolean) => log.push(`play ★${chart.stars} saved=${saved}`),
}));
vi.mock('@/features/generate-chart', () => ({
  decodeSongFile: async () => (log.push('decode'), { duration: 60 }),
  chartFromBuffer: async (_b: unknown, who: { title: string }, _p: unknown, fit: { targetStars: number }) => (
    log.push(`compose ${who.title} ★${fit.targetStars}`),
    { chart: { stars: fit.targetStars } }
  ),
  GENERATOR_VERSION: 2,
}));

const { playHarder } = await import('./playHarder');
const deps = (live = () => true) => ({ onProgress: () => undefined, go: () => undefined, live });

describe('«Сложнее» on an own song', () => {
  beforeEach(() => {
    log.length = 0;
    stored = song;
  });

  it('lets the last buffer go, decodes the saved file once, composes at the asked ★, saves it as the chart of the song and plays it', async () => {
    expect(await playHarder('custom:1', 4, deps())).toBe('ok');
    expect(log).toEqual(['context', 'release', 'load', 'decode', 'compose Моя песня ★4', 'save ★4', 'play ★4 saved=true']);
  });

  it('says so when the song is gone, and plays nothing once the sheet let go', async () => {
    stored = null;
    expect(await playHarder('custom:1', 4, deps())).toBe('missing');
    stored = song;
    log.length = 0;
    let calls = 0;
    expect(
      await playHarder(
        'custom:1',
        4,
        deps(() => ++calls < 2),
      ),
    ).toBe('cancelled');
    expect(log.some((l) => l.startsWith('play'))).toBe(false);
  });
});
