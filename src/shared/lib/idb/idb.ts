/**
 * A tiny promise layer over IndexedDB — only what the song catalog needs: open with an upgrade
 * step, turn a request or a transaction into a promise, recognise a full disk. No dependency.
 */

/** IndexedDB exists in this environment (not in node tests, not in some private modes). */
export function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    // Some browsers throw on the mere access when storage is blocked.
    return false;
  }
}

/**
 * Open (and create or upgrade) a database. `upgrade` runs inside the version-change transaction
 * with the version the database had before (0 = new). A database that another tab wants to
 * upgrade is closed here so that tab is not blocked.
 */
export function openDb(name: string, version: number, upgrade: (db: IDBDatabase, oldVersion: number) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(name, version);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error(`indexedDB.open(${name}) failed`));
    req.onblocked = () => reject(new Error(`indexedDB.open(${name}) blocked`));
  });
}

/** One request as a promise. */
export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/** Resolves when the transaction commits; rejects with its error when it fails or is aborted (a full disk aborts it). */
export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new DOMException('IndexedDB transaction aborted', 'AbortError'));
  });
}

/** The error means the disk (or the origin's share of it) is full. */
export function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  // Old Firefox reports NS_ERROR_DOM_QUOTA_REACHED, old Safari code 22.
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || (err as { code?: unknown }).code === 22;
}

/** The connection went away under us (Safari closes idle databases in the background): open again and retry. */
export function isClosedError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { name?: unknown }).name === 'InvalidStateError';
}

/**
 * Free bytes the browser still lets this origin use, or `null` when it does not say
 * (`navigator.storage.estimate()` is missing or fails). An estimate: the write may still fail.
 */
export async function freeStorageBytes(): Promise<number | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
    const { quota, usage } = await navigator.storage.estimate();
    if (typeof quota !== 'number' || typeof usage !== 'number') return null;
    return Math.max(0, quota - usage);
  } catch {
    return null;
  }
}

/**
 * Ask the browser to keep this origin's data under storage pressure (`navigator.storage.persist()`).
 * Resolves to whether storage is persistent; never throws.
 */
export async function persistStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
