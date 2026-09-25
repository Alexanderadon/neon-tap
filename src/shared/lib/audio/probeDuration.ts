/** The part of a media element the probe uses (HTMLAudioElement in the browser; a fake in tests). */
export interface ProbeElement {
  preload: string;
  src: string;
  readonly duration: number;
  onloadedmetadata: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  removeAttribute(name: string): void;
  load(): void;
}

export interface ProbeOptions {
  /** Give up after this long (a browser that never loads metadata without a gesture, a broken file). */
  timeoutMs?: number;
  /** The element factory (`new Audio()` by default). */
  make?: () => ProbeElement;
}

/** The metadata of a local file arrives in milliseconds; this only bounds a browser that never answers. */
export const PROBE_TIMEOUT_MS = 2500;

/**
 * A file's duration in seconds from its header, before anything is decoded: a media element reads
 * the metadata of a blob URL (MP3 frames / Xing, WAV header, OGG pages) without holding the PCM. A
 * 40-minute MP3 decodes to ≈0.9 GB of Float32 audio — enough to kill a phone's tab — so the length
 * is checked here first. Null when it cannot tell (no media element, an error, an unknown or
 * infinite duration, the timeout): the caller then decodes and checks the exact length.
 */
export function probeDuration(file: Blob, opts: ProbeOptions = {}): Promise<number | null> {
  const make = opts.make ?? (typeof Audio === 'function' ? () => new Audio() : null);
  if (!make || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    let el: ProbeElement;
    let url: string;
    try {
      el = make();
      url = URL.createObjectURL(file);
    } catch {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (duration: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.onloadedmetadata = null;
      el.onerror = null;
      try {
        // Let go of the file: no source, and the element forgets what it loaded.
        el.removeAttribute('src');
        el.load();
      } catch {
        /* nothing to release */
      }
      URL.revokeObjectURL(url);
      resolve(duration !== null && Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    const timer = setTimeout(() => finish(null), opts.timeoutMs ?? PROBE_TIMEOUT_MS);
    el.preload = 'metadata';
    el.onloadedmetadata = () => finish(el.duration);
    el.onerror = () => finish(null);
    el.src = url;
  });
}
