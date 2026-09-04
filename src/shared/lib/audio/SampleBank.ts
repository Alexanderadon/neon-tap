import { audioEngine } from './AudioEngine';

export interface PlayOptions {
  /** Absolute audio-clock time; defaults to now. */
  when?: number;
  /** Linear gain multiplier. */
  gain?: number;
  /** Playback rate (pitch); 1 = original. */
  rate?: number;
  destination?: AudioNode;
}

/**
 * Decoded one-shot samples addressed by name, with round-robin groups (`hit-0 … hit-4`)
 * so rapid repeats don't sound like a machine gun. Loading is idempotent; playing an
 * unloaded sample is a silent no-op so callers can offer a synthesised fallback.
 */
export class SampleBank {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly groups = new Map<string, string[]>();
  private readonly cursor = new Map<string, number>();
  private loading: Promise<void> | null = null;
  private failed = 0;

  constructor(private readonly baseUrl: string) {}

  /** Load every name once; missing files are tolerated (counted in `failures`). */
  load(names: readonly string[]): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = Promise.all(
      names.map(async (name) => {
        try {
          this.buffers.set(name, await audioEngine.loadUrl(`${this.baseUrl}${name}.mp3`));
          const m = /^(.*)-(\d+)$/.exec(name);
          if (m) {
            const list = this.groups.get(m[1]) ?? [];
            list.push(name);
            list.sort();
            this.groups.set(m[1], list);
          }
        } catch {
          this.failed++;
        }
      }),
    ).then(() => undefined);
    return this.loading;
  }

  get failures(): number {
    return this.failed;
  }

  has(name: string): boolean {
    return this.buffers.has(name) || this.groups.has(name);
  }

  /** Play `name` or the next variant of group `name`. Returns false when nothing is loaded. */
  play(name: string, opts: PlayOptions = {}): boolean {
    const ctx = audioEngine.context;
    if (!ctx) return false;
    let key = name;
    const group = this.groups.get(name);
    if (group && group.length) {
      const i = (this.cursor.get(name) ?? -1) + 1;
      // Random-but-never-the-same-twice round robin.
      const next = group.length === 1 ? 0 : (i + Math.floor(Math.random() * (group.length - 1))) % group.length;
      this.cursor.set(name, next);
      key = group[next];
    }
    const buffer = this.buffers.get(key);
    if (!buffer) return false;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = opts.rate ?? 1;
    const gain = ctx.createGain();
    gain.gain.value = opts.gain ?? 1;
    src.connect(gain).connect(opts.destination ?? audioEngine.sfxDestination);
    src.start(Math.max(opts.when ?? ctx.currentTime, ctx.currentTime));
    return true;
  }
}
