/**
 * The single source of truth for song time.
 *
 * All note logic derives from `audioContext.currentTime` (passed in as `now`), never from
 * `performance.now()` — the latter drifts relative to the audio hardware clock and desyncs
 * within ~30 s. `requestAnimationFrame` is used for drawing only.
 *
 * Playback rate can change (slow-motion spell): song position is the integral of the rate over
 * audio time, with linear ramps integrated analytically so clock and music stay sample-locked.
 */
export class Clock {
  private startTime = 0;
  private pausedAt: number | null = null;
  private running = false;
  // Rate model: position(t) = anchorP + ∫ rate over [anchorA, t]; rate ramps linearly from
  // rateFrom to rateTo over [rampStart, rampEnd] and is constant outside.
  private anchorA = 0;
  private anchorP = 0;
  private rateFrom = 1;
  private rateTo = 1;
  private rampStart = 0;
  private rampEnd = 0;

  constructor(
    private readonly now: () => number,
    /** Seconds; positive = player hears audio late, so notes are judged later (the residual after `deviceLatency`). */
    public userOffset = 0,
    /**
     * Seconds the device's audio output lags the audio clock (AudioContext output + base latency,
     * a Bluetooth headset adds far more): the sound the player hears is this much behind
     * `position()`, so tiles and judgements run this much later too. Set from the engine; updated live.
     */
    public deviceLatency = 0,
  ) {}

  /** `startTime` is the audio-clock instant that corresponds to song position `position` (default 0). */
  start(startTime: number, position = 0): void {
    this.startTime = startTime;
    this.pausedAt = null;
    this.running = true;
    this.anchorA = startTime;
    this.anchorP = position;
    this.rateFrom = this.rateTo = 1;
    this.rampStart = this.rampEnd = startTime;
  }

  pause(): void {
    if (!this.running || this.pausedAt !== null) return;
    this.pausedAt = this.now();
  }

  /** Resume at the same song position: shift every audio-time anchor by the pause duration. */
  resume(): void {
    if (this.pausedAt === null) return;
    const gap = this.now() - this.pausedAt;
    this.startTime += gap;
    this.anchorA += gap;
    this.rampStart += gap;
    this.rampEnd += gap;
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

  /** Current playback rate at audio time `t` (default now). */
  rateAt(t = this.now()): number {
    if (t <= this.rampStart) return this.rateFrom;
    if (t >= this.rampEnd) return this.rateTo;
    return this.rateFrom + ((this.rateTo - this.rateFrom) * (t - this.rampStart)) / (this.rampEnd - this.rampStart);
  }

  /** Ramp the rate linearly to `rate` over `duration` seconds starting at audio time `at` (default now). */
  setRate(rate: number, duration = 0, at = this.now()): void {
    const p = this.positionAt(at);
    const r = this.rateAt(at);
    this.anchorA = at;
    this.anchorP = p;
    this.rateFrom = r;
    this.rateTo = rate;
    this.rampStart = at;
    this.rampEnd = at + Math.max(0, duration);
  }

  /** Song position (seconds of audio buffer) at audio time `t`, ignoring the user offset. */
  positionAt(t: number): number {
    if (!this.running) return 0;
    if (t <= this.rampStart) return this.anchorP + (t - this.anchorA) * this.rateFrom;
    const base = this.anchorP + (this.rampStart - this.anchorA) * this.rateFrom;
    const T = this.rampEnd - this.rampStart;
    if (T > 0 && t < this.rampEnd) {
      const u = t - this.rampStart;
      return base + this.rateFrom * u + ((this.rateTo - this.rateFrom) * u * u) / (2 * T);
    }
    const atEnd = base + ((this.rateFrom + this.rateTo) / 2) * T;
    return atEnd + (t - this.rampEnd) * this.rateTo;
  }

  /** Song position now (buffer seconds, no offset) — use for pausing/resuming the audio source. */
  position(): number {
    return this.positionAt(this.pausedAt ?? this.now());
  }

  /** Everything that separates the audio clock from the player's tap: device output latency plus their own bias. */
  get heardOffset(): number {
    return this.deviceLatency + this.userOffset;
  }

  /**
   * Song time as the player hears it, in seconds: position minus device latency. This is what the
   * tiles are drawn against, so a tile meets the line exactly when its sound is heard — the
   * player's own tap bias (`userOffset`) never moves the picture, only the judgement.
   */
  songTime(): number {
    if (!this.running) return 0;
    return this.position() - this.deviceLatency;
  }

  /** The judgement's idea of song time: heard time shifted by the player's calibrated tap bias. */
  judgeTime(): number {
    if (!this.running) return 0;
    return this.position() - this.heardOffset;
  }

  /** Convert an absolute audio-clock timestamp (an input event) to judgement song time. */
  toSongTime(audioTime: number): number {
    return this.positionAt(audioTime) - this.heardOffset;
  }

  /** Convert judgement song time to the absolute audio-clock instant (constant-rate approximation). */
  toAudioTime(songTime: number): number {
    return this.anchorA + (songTime + this.heardOffset - this.anchorP) / this.rateAt();
  }
}
