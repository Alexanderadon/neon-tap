import type { ChartFile } from '@/shared/types/chart';
import type { AddOutcome, ChartPatch, NewSong, SongMeta, SongPatch, SongRepo } from './types';

interface MemoryOptions {
  /** Total audio bytes the "disk" holds; an add beyond it throws `QuotaExceededError` like a full IndexedDB. */
  maxBytes?: number;
}

const copy = <T>(value: T): T => structuredClone(value);

/**
 * The song storage in memory, for tests (node has no IndexedDB). Behaves like `idbRepo`: every
 * call is one atomic step, the calls run one after another in call order (IndexedDB serialises
 * overlapping read-write transactions the same way), values are copied in and out.
 */
export function memoryRepo(initial: readonly NewSong[] = [], opts: MemoryOptions = {}): SongRepo {
  const metas = new Map<string, SongMeta>();
  const charts = new Map<string, ChartFile>();
  const audios = new Map<string, Blob>();
  for (const s of initial) {
    metas.set(s.meta.id, copy(s.meta));
    charts.set(s.meta.id, copy(s.chart));
    audios.set(s.meta.id, s.audio);
  }

  let queue: Promise<unknown> = Promise.resolve();
  function step<T>(fn: () => T): Promise<T> {
    const run = queue.then(async () => {
      await Promise.resolve(); // the other caller gets a turn in between, as with a real database
      return fn();
    });
    queue = run.catch(() => undefined);
    return run;
  }

  const usedBytes = () => [...audios.values()].reduce((sum, b) => sum + b.size, 0);

  return {
    list: () => step(() => [...metas.values()].map(copy)),
    count: () => step(() => metas.size),
    get: (id) => step(() => (metas.has(id) ? copy(metas.get(id)!) : undefined)),
    add: (song, limit) =>
      step((): AddOutcome => {
        const id = song.meta.id;
        if (metas.has(id)) return 'duplicate';
        if (limit !== null && metas.size >= limit) return 'limit';
        if (opts.maxBytes !== undefined && usedBytes() + song.audio.size > opts.maxBytes) {
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        }
        metas.set(id, copy(song.meta));
        charts.set(id, copy(song.chart));
        audios.set(id, song.audio);
        return 'ok';
      }),
    chart: (id) => step(() => (charts.has(id) ? copy(charts.get(id)!) : undefined)),
    audio: (id) => step(() => audios.get(id)),
    update: (id, patch: SongPatch) =>
      step(() => {
        const prev = metas.get(id);
        if (!prev) return undefined;
        const next: SongMeta = { ...prev, ...copy(patch), id };
        metas.set(id, next);
        return copy(next);
      }),
    replaceChart: (id, chart, patch: ChartPatch) =>
      step(() => {
        const prev = metas.get(id);
        if (!prev) return undefined;
        const next: SongMeta = { ...prev, ...patch, id };
        metas.set(id, next);
        charts.set(id, copy(chart));
        return copy(next);
      }),
    remove: (id) =>
      step(() => {
        metas.delete(id);
        charts.delete(id);
        audios.delete(id);
      }),
  };
}
