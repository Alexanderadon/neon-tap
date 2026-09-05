import { describe, expect, it } from 'vitest';
import { SPECTRUM_BANDS, bandLayout, spectrumBands } from './spectrum';

describe('spectrum bands', () => {
  it('lays out 32 non-overlapping, monotone, log-ish bands over 128 bins', () => {
    const L = bandLayout(128, SPECTRUM_BANDS);
    expect(L.edges).toHaveLength(SPECTRUM_BANDS + 1);
    expect(L.edges[0]).toBe(1);
    expect(L.edges[SPECTRUM_BANDS]).toBe(128);
    for (let i = 0; i < SPECTRUM_BANDS; i++) expect(L.edges[i + 1]).toBeGreaterThan(L.edges[i]);
    // Log spacing: the top band is far wider than the bottom one.
    const first = L.edges[1] - L.edges[0];
    const last = L.edges[SPECTRUM_BANDS] - L.edges[SPECTRUM_BANDS - 1];
    expect(last).toBeGreaterThan(first * 4);
  });

  it('never breaks when there are fewer bins than bands', () => {
    const L = bandLayout(8, 32);
    for (let i = 0; i < 32; i++) expect(L.edges[i + 1]).toBe(L.edges[i] + 1);
  });

  it('averages the bins of each band and reuses the output buffer', () => {
    const raw = new Uint8Array(128).fill(0);
    raw.fill(200, 1, 4); // bass
    raw.fill(100, 64, 128); // top octave
    const out = new Uint8Array(SPECTRUM_BANDS);
    spectrumBands(raw, out);
    expect(out[0]).toBe(200);
    expect(out[SPECTRUM_BANDS - 1]).toBe(100);
    // Something in the middle is silent.
    expect(out[16]).toBe(0);
    // Second call overwrites in place.
    raw.fill(0);
    spectrumBands(raw, out);
    expect(Array.from(out).every((v) => v === 0)).toBe(true);
  });

  it('keeps values in byte range and treats missing bins as silence', () => {
    const raw = new Uint8Array(16).fill(255);
    const out = new Uint8Array(32);
    spectrumBands(raw, out);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
    expect(out[0]).toBe(255);
    expect(out[31]).toBe(0);
  });
});
