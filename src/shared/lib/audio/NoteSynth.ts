/** Voices playing at once; the oldest is stolen beyond this. */
const MAX_VOICES = 6;
const ATTACK = 0.004;
/** A tapped note decays to its sustain level over this long… */
const DECAY = 0.22;
/** …and rings at this share of its peak while held. */
const SUSTAIN = 0.32;
const RELEASE = 0.16;
/** How long a plain tap's note rings (a held note rings until released). */
const TAP_LENGTH = 0.28;

interface Voice {
  midi: number;
  osc: OscillatorNode;
  osc2: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  /** Level the envelope settles at while held (where a scheduled stop starts its release from). */
  sustainLevel: number;
}

/**
 * The Magic Tiles sound: a hit plays the note of the melody the tile stands for. A small
 * dependency-free electric-piano voice — two oscillators through a closing low-pass with a
 * pluck envelope — so every tap is heard as "you played that note", and a miss is the note
 * that did not sound. Sits on the music bus, so the music volume setting applies.
 */
export class NoteSynth {
  private readonly voices: Voice[] = [];
  private readonly out: GainNode;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    level = 0.5,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = level;
    this.out.connect(destination);
  }

  /** Start a note. `hold` keeps it ringing until `release(midi)`; otherwise it rings TAP_LENGTH. `velocity` 0..1. */
  play(midi: number, hold = false, velocity = 1): void {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (this.voices.length >= MAX_VOICES) this.stop(this.voices[0], t, null);
    const hz = 440 * 2 ** ((midi - 69) / 12);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hz;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = hz * 2;
    osc2.detune.value = 4;
    const mix2 = ctx.createGain();
    mix2.gain.value = 0.35;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(Math.min(12000, Math.max(900, hz * 6)), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(600, hz * 2.2), t + DECAY * 1.6);
    const gain = ctx.createGain();
    const peak = 0.25 + 0.75 * Math.max(0, Math.min(1, velocity));
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + ATTACK);
    gain.gain.exponentialRampToValueAtTime(peak * SUSTAIN, t + ATTACK + DECAY);
    osc.connect(filter);
    osc2.connect(mix2);
    mix2.connect(filter);
    filter.connect(gain);
    gain.connect(this.out);
    osc.start(t);
    osc2.start(t);
    const voice: Voice = { midi, osc, osc2, gain, filter, sustainLevel: peak * SUSTAIN };
    this.voices.push(voice);
    if (!hold) this.stop(voice, t + TAP_LENGTH, voice.sustainLevel);
  }

  /** Let a held note go (the tail of a hold or slide). */
  release(midi: number): void {
    const v = this.voices.find((x) => x.midi === midi);
    if (v) this.stop(v, this.ctx.currentTime, null);
  }

  /** Everything off (pause, stop, restart). */
  releaseAll(): void {
    const t = this.ctx.currentTime;
    for (const v of [...this.voices]) this.stop(v, t, null);
  }

  /** Release from `at`: `level` is the envelope value there (null = whatever it is right now). */
  private stop(v: Voice, at: number, level: number | null): void {
    const i = this.voices.indexOf(v);
    if (i >= 0) this.voices.splice(i, 1);
    const g = v.gain.gain;
    // Cancelling a ramp in flight snaps the value back; hold it instead where the browser can.
    const p = g as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(at);
    else {
      g.cancelScheduledValues(at);
      g.setValueAtTime(Math.max(0.0001, level ?? g.value), at);
    }
    g.exponentialRampToValueAtTime(0.0001, at + RELEASE);
    v.osc.stop(at + RELEASE + 0.02);
    v.osc2.stop(at + RELEASE + 0.02);
  }
}
