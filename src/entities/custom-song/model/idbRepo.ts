import { isClosedError, openDb, transactionDone } from '@/shared/lib/idb';
import type { ChartFile } from '@/shared/types/chart';
import type { AddOutcome, SongMeta, SongRepo } from './types';

export const SONGS_DB = 'neon-tap-songs';
const VERSION = 1;
/** `meta`: SongMeta by `id` (the list); `charts`: ChartFile by id; `audio`: the original file (Blob) by id. */
const META = 'meta';
const CHARTS = 'charts';
const AUDIO = 'audio';
const ALL = [META, CHARTS, AUDIO];

/**
 * The songs in IndexedDB `neon-tap-songs` v1. The database opens on the first call; a connection
 * the browser closed in the background is reopened once. Each method is one transaction.
 */
export function idbRepo(name: string = SONGS_DB): SongRepo {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const db = (): Promise<IDBDatabase> => {
    dbPromise ??= openDb(name, VERSION, (d) => {
      if (!d.objectStoreNames.contains(META)) d.createObjectStore(META, { keyPath: 'id' });
      if (!d.objectStoreNames.contains(CHARTS)) d.createObjectStore(CHARTS);
      if (!d.objectStoreNames.contains(AUDIO)) d.createObjectStore(AUDIO);
    }).catch((err: unknown) => {
      dbPromise = null;
      throw err;
    });
    return dbPromise;
  };

  /** Run `issue` in a transaction; its returned getter is read once the transaction has committed. */
  async function tx<T>(stores: string[], mode: IDBTransactionMode, issue: (t: IDBTransaction) => () => T): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const d = await db();
      let t: IDBTransaction;
      try {
        t = d.transaction(stores, mode);
      } catch (err) {
        if (attempt === 0 && isClosedError(err)) {
          dbPromise = null;
          continue;
        }
        throw err;
      }
      const done = transactionDone(t);
      let read: () => T;
      try {
        read = issue(t);
      } catch (err) {
        done.catch(() => undefined);
        try {
          t.abort();
        } catch {
          /* already finished */
        }
        throw err;
      }
      await done;
      return read();
    }
  }

  return {
    list: () =>
      tx([META], 'readonly', (t) => {
        const r = t.objectStore(META).getAll();
        return () => (r.result ?? []) as SongMeta[];
      }),
    count: () =>
      tx([META], 'readonly', (t) => {
        const r = t.objectStore(META).count();
        return () => r.result;
      }),
    get: (id) =>
      tx([META], 'readonly', (t) => {
        const r = t.objectStore(META).get(id);
        return () => r.result as SongMeta | undefined;
      }),
    add: (song, limit) =>
      tx(ALL, 'readwrite', (t) => {
        let outcome: AddOutcome = 'ok';
        const id = song.meta.id;
        const meta = t.objectStore(META);
        // The duplicate check, the slot count and the writes share this transaction.
        const same = meta.count(id);
        same.onsuccess = () => {
          if (same.result > 0) {
            outcome = 'duplicate';
            return;
          }
          const total = meta.count();
          total.onsuccess = () => {
            if (limit !== null && total.result >= limit) {
              outcome = 'limit';
              return;
            }
            meta.put(song.meta);
            t.objectStore(CHARTS).put(song.chart, id);
            t.objectStore(AUDIO).put(song.audio, id);
          };
        };
        return () => outcome;
      }),
    chart: (id) =>
      tx([CHARTS], 'readonly', (t) => {
        const r = t.objectStore(CHARTS).get(id);
        return () => r.result as ChartFile | undefined;
      }),
    audio: (id) =>
      tx([AUDIO], 'readonly', (t) => {
        const r = t.objectStore(AUDIO).get(id);
        return () => (r.result instanceof Blob ? r.result : undefined);
      }),
    update: (id, patch) =>
      tx([META], 'readwrite', (t) => {
        let next: SongMeta | undefined;
        const store = t.objectStore(META);
        const r = store.get(id);
        r.onsuccess = () => {
          const prev = r.result as SongMeta | undefined;
          if (!prev) return;
          next = { ...prev, ...patch, id };
          store.put(next);
        };
        return () => next;
      }),
    replaceChart: (id, chart, patch) =>
      tx([META, CHARTS], 'readwrite', (t) => {
        let next: SongMeta | undefined;
        const store = t.objectStore(META);
        const r = store.get(id);
        r.onsuccess = () => {
          const prev = r.result as SongMeta | undefined;
          if (!prev) return;
          next = { ...prev, ...patch, id };
          store.put(next);
          t.objectStore(CHARTS).put(chart, id);
        };
        return () => next;
      }),
    remove: (id) =>
      tx(ALL, 'readwrite', (t) => {
        for (const s of ALL) t.objectStore(s).delete(id);
        return () => undefined;
      }),
  };
}
