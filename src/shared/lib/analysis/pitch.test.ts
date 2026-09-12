import { describe, expect, it } from 'vitest';
import { detectPitch, midiToHz } from './pitch';

const SR = 22050;

/** A note with harmonics (a sawtooth-ish tone) plus a little noise, `sec` long. */
function tone(midi: number, sec = 0.3, noise = 0.02): Float32Array {
  const hz = midiToHz(midi);
  const out = new Float32Array(Math.floor(sec * SR));
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000) * 2 - 1;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let v = 0;
    for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * hz * h * t) / h;
    out[i] = v * 0.3 + noise * rnd();
  }
  return out;
}

describe('detectPitch', () => {
  it('finds the note of a harmonic tone within a quarter semitone, low bass to high voice', () => {
    for (const midi of [36, 45, 57, 64, 72, 81]) {
      const got = detectPitch(tone(midi), SR, 0.02);
      expect(got, `midi ${midi}`).not.toBeNull();
      expect(Math.abs(got! - midi), `midi ${midi}`).toBeLessThan(0.25);
    }
  });

  it('hears nothing in silence or noise, and nothing past the end', () => {
    expect(detectPitch(new Float32Array(SR), SR, 0.1)).toBeNull();
    let seed = 3;
    const noise = Float32Array.from({ length: SR }, () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000 - 0.5) * 0.6);
    expect(detectPitch(noise, SR, 0.1)).toBeNull();
    expect(detectPitch(tone(60, 0.05), SR, 0.02)).toBeNull();
  });

  it('picks the fundamental, not an octave below it', () => {
    const got = detectPitch(tone(69), SR, 0.02)!;
    expect(Math.abs(got - 69)).toBeLessThan(0.25);
  });
});
