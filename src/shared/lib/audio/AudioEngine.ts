/**
 * Thin, dependency-free wrapper over the Web Audio API.
 *
 * Graph:  music ─▶ lowpass ─▶ musicGain ─┐
 *         sfxGain ──────────────────────┼─▶ master ─▶ destination
 *         voiceGain ────────────────────┘
 *
 * The lowpass filter implements the "miss breaks the music" effect (GDD §1.2).
 */
import { bassFromBins, spectrumBands } from './spectrum';

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  voice: number;
}

/** Fade in / out of a shop preview clip, seconds. */
const PREVIEW_FADE = 0.25;
/** The menu radio: fade in / out, seconds. */
const AMBIENT_FADE_IN = 0.9;
const AMBIENT_FADE_OUT = 0.35;
/** Where a fade starts or ends: -40 dB, quiet enough to read as silence, high enough for an exponential ramp. */
const FADE_FLOOR = 0.01;
const LOWPASS_OPEN_HZ = 20000;
const LOWPASS_MISS_HZ = 800;
const MISS_DURATION = 0.25;
const MISS_GAIN_DIP = 0.6;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private voiceGain!: GainNode;
  private lowpass!: BiquadFilterNode;
  private analyser: AnalyserNode | null = null;
  private spectrumBins: Uint8Array<ArrayBuffer> | null = null;
  private source: AudioBufferSourceNode | null = null;
  /** The menu radio's fade node — ramped down by `stopAmbient`, so the song does not cut. */
  private ambientFade: GainNode | null = null;
  private startTime = 0;
  private pausePosition: number | null = null;
  private volumes: Volumes = { master: 1, music: 0.9, sfx: 0.8, voice: 1 };
  private onEnded: (() => void) | null = null;

  /** Must be called from a user gesture on iOS/Chrome. Safe to call repeatedly. */
  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.voiceGain = this.ctx.createGain();
      this.lowpass = this.ctx.createBiquadFilter();
      this.lowpass.type = 'lowpass';
      this.lowpass.frequency.value = LOWPASS_OPEN_HZ;
      this.lowpass.Q.value = 0.7;
      this.lowpass.connect(this.musicGain);
      this.musicGain.connect(this.master);
      // Analyser taps the music bus for audio-reactive visuals (bass pulse). Not in the audible path.
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      this.musicGain.connect(this.analyser);
      this.spectrumBins = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      this.sfxGain.connect(this.master);
      this.voiceGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyVolumes();
    }
    // resume() rejects/hangs outside a user gesture (iOS "interrupted", Chrome autoplay policy).
    // Never fatal: the caller gets the context, and the audio gate re-appears while it is not running.
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* the next tap on the audio gate resumes it */
      }
    }
    return this.ctx;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Audio hardware clock in seconds — the only time source for gameplay. */
  now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Estimated output latency reported by the browser (0 when unsupported). */
  outputLatency(): number {
    if (!this.ctx) return 0;
    const c = this.ctx as AudioContext & { outputLatency?: number };
    return (c.outputLatency ?? 0) + (c.baseLatency ?? 0);
  }

  /**
   * Bass energy of what is playing right now, 0..1 (bins up to ~500 Hz). One analyser read; when
   * the caller also needs the spectrum, use `spectrum()` alone — it returns the same value from the
   * same read instead of sampling the analyser twice per frame.
   */
  bassLevel(): number {
    if (!this.analyser || !this.spectrumBins) return 0;
    this.analyser.getByteFrequencyData(this.spectrumBins);
    return bassFromBins(this.spectrumBins);
  }

  /**
   * Fill `out` (caller-owned, reused every frame) with `out.length` log-spaced spectrum bands,
   * 0..255, for the audio-reactive background, and return the bass level (0..1) of the same read.
   * Zeroes / 0 when there is no context / analyser.
   */
  spectrum(out: Uint8Array): number {
    if (!this.analyser || !this.spectrumBins) {
      out.fill(0);
      return 0;
    }
    this.analyser.getByteFrequencyData(this.spectrumBins);
    spectrumBands(this.spectrumBins, out);
    return bassFromBins(this.spectrumBins);
  }

  get sfxDestination(): AudioNode {
    return this.sfxGain;
  }

  get voiceDestination(): AudioNode {
    return this.voiceGain;
  }

  setVolumes(v: Partial<Volumes>): void {
    this.volumes = { ...this.volumes, ...v };
    if (this.ctx) this.applyVolumes();
  }

  private applyVolumes(): void {
    this.master.gain.value = this.volumes.master;
    this.musicGain.gain.value = this.volumes.music;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.voiceGain.gain.value = this.volumes.voice;
  }

  async decode(data: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = await this.ensureContext();
    return ctx.decodeAudioData(data);
  }

  async loadUrl(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load audio: ${url} (${res.status})`);
    return this.decode(await res.arrayBuffer());
  }

  /**
   * Start playback of `buffer` at song position `position`.
   * Returns the audio-clock time that corresponds to song position 0 (feed it to Clock.start).
   */
  play(buffer: AudioBuffer, position = 0, onEnded?: () => void, delay = 0.08): number {
    const ctx = this.ctx;
    if (!ctx) throw new Error('AudioContext not initialised');
    this.stop();
    this.onEnded = onEnded ?? null;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.lowpass);
    const when = ctx.currentTime + Math.max(0.08, delay); // small lead so start() is sample-accurate
    src.start(when, position);
    src.onended = () => {
      if (this.source === src) {
        this.source = null;
        this.onEnded?.();
      }
    };
    this.source = src;
    this.startTime = when - position;
    this.pausePosition = null;
    return this.startTime;
  }

  /**
   * A short listen (the shop): `seconds` of `buffer` from `from`, fading out at the end. Stops
   * whatever was playing; `stop()` cuts it early. `onDone` fires when the clip ends or is stopped.
   */
  preview(buffer: AudioBuffer, from: number, seconds: number, onDone?: () => void): void {
    const ctx = this.ctx;
    if (!ctx) throw new Error('AudioContext not initialised');
    this.stop();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const fade = ctx.createGain();
    const t = ctx.currentTime;
    fade.gain.setValueAtTime(0.0001, t);
    fade.gain.exponentialRampToValueAtTime(1, t + PREVIEW_FADE);
    fade.gain.setValueAtTime(1, t + seconds - PREVIEW_FADE);
    fade.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(fade);
    fade.connect(this.lowpass);
    src.start(t, Math.max(0, Math.min(from, Math.max(0, buffer.duration - seconds))), seconds);
    src.onended = () => {
      if (this.source === src) {
        this.source = null;
        this.onEnded?.();
      }
    };
    this.onEnded = onDone ?? null;
    this.source = src;
    this.startTime = t - from;
    this.pausePosition = null;
  }

  /**
   * The menu radio: `buffer` loops from `from` to its end at `level` of the music volume, fading in.
   * Stops whatever was playing; `stopAmbient()` fades it out, any `play()` / `preview()` cuts it.
   */
  ambient(buffer: AudioBuffer, from: number, level: number): void {
    const ctx = this.ctx;
    if (!ctx) throw new Error('AudioContext not initialised');
    this.stop();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = Math.max(0, Math.min(from, buffer.duration - 1));
    src.loopEnd = buffer.duration;
    const fade = ctx.createGain();
    const t = ctx.currentTime;
    fade.gain.setValueAtTime(FADE_FLOOR * level, t);
    fade.gain.exponentialRampToValueAtTime(level, t + AMBIENT_FADE_IN);
    src.connect(fade);
    fade.connect(this.lowpass);
    src.start(t, src.loopStart);
    src.onended = () => {
      if (this.source === src) this.source = null;
    };
    this.onEnded = null;
    this.ambientFade = fade;
    this.source = src;
    this.startTime = t - src.loopStart;
    this.pausePosition = null;
  }

  /** Fade the radio out and stop it (no-op when nothing ambient plays). */
  stopAmbient(): void {
    const ctx = this.ctx;
    const fade = this.ambientFade;
    const src = this.source;
    if (!ctx || !fade || !src) {
      this.ambientFade = null;
      return;
    }
    this.ambientFade = null;
    this.source = null;
    src.onended = null;
    const t = ctx.currentTime;
    fade.gain.cancelScheduledValues(t);
    fade.gain.setValueAtTime(Math.max(FADE_FLOOR, fade.gain.value), t);
    fade.gain.exponentialRampToValueAtTime(FADE_FLOOR, t + AMBIENT_FADE_OUT);
    src.stop(t + AMBIENT_FADE_OUT);
  }

  /** Is the menu radio the thing playing? */
  get isAmbient(): boolean {
    return this.ambientFade !== null && this.source !== null;
  }

  /** Current song position according to the audio clock. */
  position(): number {
    if (this.pausePosition !== null) return this.pausePosition;
    if (!this.ctx || !this.source) return 0;
    return this.ctx.currentTime - this.startTime;
  }

  pause(): void {
    if (!this.source || this.pausePosition !== null) return;
    this.pausePosition = this.position();
    const src = this.source;
    this.source = null;
    src.onended = null;
    src.stop();
  }

  stop(): void {
    this.ambientFade = null;
    if (this.source) {
      const src = this.source;
      this.source = null;
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.pausePosition = null;
    this.resetFilter();
  }

  get isPlaying(): boolean {
    return this.source !== null;
  }

  /** Ramp the music playback rate (slow-motion spell). Linear, so the Clock can integrate it exactly. */
  setPlaybackRate(rate: number, duration = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.source) return;
    const t = ctx.currentTime;
    const p = this.source.playbackRate;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(rate, t + Math.max(0.001, duration));
  }

  /** "Tape stop" colour for slow-motion: muffle + duck while slowed, open back up on release. */
  tapeEffect(on: boolean, duration = 0.35): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = this.lowpass.frequency;
    const g = this.musicGain.gain;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(200, f.value), t);
    f.exponentialRampToValueAtTime(on ? 1400 : LOWPASS_OPEN_HZ, t + duration);
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.volumes.music * (on ? 0.7 : 1), t + duration);
  }

  /**
   * Fade the music out to silence over `seconds` (the end of a level): an equal-loudness curve down
   * to -40 dB, then off. The source keeps playing; `play()` resets the bus.
   */
  fadeOut(seconds: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const g = this.musicGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(FADE_FLOOR, g.value), t);
    g.exponentialRampToValueAtTime(FADE_FLOOR, t + Math.max(0.05, seconds));
    g.setValueAtTime(0, t + Math.max(0.05, seconds) + 0.001);
  }

  /** Bring the music in from silence over `seconds`, starting at audio time `from` (default now) — call after `play()`. */
  fadeIn(seconds: number, from?: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const start = Math.max(t, from ?? t);
    const g = this.musicGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(FADE_FLOOR, t);
    g.setValueAtTime(FADE_FLOOR, start);
    g.exponentialRampToValueAtTime(this.volumes.music, start + Math.max(0.05, seconds));
  }

  /** "Miss breaks the music": muffle + duck the master for 250 ms (GDD §1.2). */
  missEffect(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = this.lowpass.frequency;
    const g = this.musicGain.gain;
    f.cancelScheduledValues(t);
    f.setValueAtTime(LOWPASS_MISS_HZ, t);
    f.exponentialRampToValueAtTime(LOWPASS_OPEN_HZ, t + MISS_DURATION);
    g.cancelScheduledValues(t);
    g.setValueAtTime(this.volumes.music * MISS_GAIN_DIP, t);
    g.linearRampToValueAtTime(this.volumes.music, t + MISS_DURATION);
  }

  private resetFilter(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.lowpass.frequency.cancelScheduledValues(t);
    this.lowpass.frequency.value = LOWPASS_OPEN_HZ;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.value = this.volumes.music;
  }

  /** Play a decoded one-shot (voice line) through the voice bus. */
  playOneShot(buffer: AudioBuffer, destination: AudioNode = this.voiceGain): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(destination);
    src.start();
  }
}

/** App-wide singleton: one AudioContext per page is the browser-recommended pattern. */
export const audioEngine = new AudioEngine();
