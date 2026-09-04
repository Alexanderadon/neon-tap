/**
 * The single source of truth for song time.
 *
 * All note logic derives from `audioContext.currentTime` (passed in as `now`), never from
 * `performance.now()` — the latter drifts relative to the audio hardware clock and desyncs
 * within ~30 s. `requestAnimationFrame` is used for drawing only.
 */
export class Clock {
  private startTime = 0;
  private pausedAt: number | null = null;
  private running = false;

  constructor(
    private readonly now: () => number,
    /** Seconds; positive = player hears audio late, so notes are judged later. */
    public userOffset = 0,
  ) {}

  /** `startTime` is the audio-clock instant that corresponds to song position 0. */
  start(startTime: number): void {
    this.startTime = startTime;
    this.pausedAt = null;
    this.running = true;
  }

  pause(): void {
    if (!this.running || this.pausedAt !== null) return;
    this.pausedAt = this.now();
  }

  /** Resume at the same song position: shift startTime by the pause duration. */
  resume(): void {
    if (this.pausedAt === null) return;
    this.startTime += this.now() - this.pausedAt;
    this.pausedAt = null;
  }

  stop(): void {
    this.running = false;
    this.pausedAt = null;
  }

  get isRunning(): boolean {
    return this.running && this.pausedAt === null;
  }

  get isPaused(): boolean {
    return this.pausedAt !== null;
  }

  /** Song time in seconds, corrected by the user's calibrated offset. */
  songTime(): number {
    if (!this.running) return 0;
    const now = this.pausedAt ?? this.now();
    return now - this.startTime - this.userOffset;
  }

  /** Convert an absolute audio-clock timestamp (e.g. an input event) to song time. */
  toSongTime(audioTime: number): number {
    return audioTime - this.startTime - this.userOffset;
  }

  /** Convert song time to the absolute audio-clock instant. */
  toAudioTime(songTime: number): number {
    return songTime + this.startTime + this.userOffset;
  }
}
