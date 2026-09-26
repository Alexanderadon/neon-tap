import { audioEngine } from './AudioEngine';
import { fetchBytes } from '@/shared/lib/net';

/**
 * Decoded songs are big (about 10 MB of memory per stereo minute): only the two latest are kept —
 * the splash decodes the first track and, on a first launch, the tutorial's song.
 */
const KEEP = 2;
/** The download is most of the wait; decoding takes the last stretch of the bar. */
const DOWNLOAD_SHARE = 0.95;

interface Pending {
  promise: Promise<AudioBuffer>;
  ctrl: AbortController;
  background: boolean;
  listeners: Set<(fraction: number) => void>;
}

const decoded = new Map<string, AudioBuffer>();
const pending = new Map<string, Pending>();

export interface SongLoadOptions {
  /** A load nobody waits for (the menu radio): the first foreground load of another song cancels it. */
  background?: boolean;
  /** 0..1 while the song downloads and decodes. */
  onProgress?: (fraction: number) => void;
}

/**
 * A song as a decoded buffer, shared by the menu radio, the shop preview and the game — so the song
 * the radio is playing is already decoded when PLAY is pressed, and one song is never downloaded
 * twice at once. A foreground load cancels background loads of other songs: on a phone they would
 * share the bandwidth with the song the player is waiting for.
 */
export function loadSong(url: string, opts: SongLoadOptions = {}): Promise<AudioBuffer> {
  const hit = decoded.get(url);
  if (hit) {
    opts.onProgress?.(1);
    return Promise.resolve(hit);
  }
  if (!opts.background) {
    for (const [other, p] of pending) {
      if (other !== url && p.background) {
        p.ctrl.abort();
        pending.delete(other);
      }
    }
  }
  let entry = pending.get(url);
  if (!entry) {
    const ctrl = new AbortController();
    const listeners = new Set<(fraction: number) => void>();
    const tell = (f: number) => listeners.forEach((l) => l(f));
    const promise: Promise<AudioBuffer> = audioEngine
      .loadUrl(url, { signal: ctrl.signal, onProgress: (loaded, total) => total > 0 && tell((loaded / total) * DOWNLOAD_SHARE) })
      .then((buffer) => {
        decoded.set(url, buffer);
        while (decoded.size > KEEP) decoded.delete(decoded.keys().next().value!);
        tell(1);
        return buffer;
      })
      .finally(() => {
        if (pending.get(url)?.promise === promise) pending.delete(url);
      });
    entry = { promise, ctrl, background: opts.background === true, listeners };
    pending.set(url, entry);
  } else if (!opts.background) {
    entry.background = false;
  }
  if (opts.onProgress) entry.listeners.add(opts.onProgress);
  return entry.promise;
}

/**
 * Drop the download of `url` if it is still a background one (the radio moved on to another card):
 * the phone's bandwidth goes to what the player looks at now. A load someone waits for in the
 * foreground (the game, the shop preview) is never cancelled; its waiters see nothing change.
 */
export function cancelBackgroundLoad(url: string): void {
  const entry = pending.get(url);
  if (!entry?.background) return;
  entry.ctrl.abort();
  pending.delete(url);
}

/**
 * Fetch a song's bytes into the browser (and, in production, the service worker's media) cache
 * without decoding it — the next cards after the splash: when one is chosen, only the decode is
 * left. Low priority where supported; never rejects.
 */
export function prefetchSong(url: string): Promise<void> {
  if (decoded.has(url) || pending.has(url)) return Promise.resolve();
  return fetchBytes(url, { retries: 1 })
    .then(() => undefined)
    .catch(() => undefined);
}
