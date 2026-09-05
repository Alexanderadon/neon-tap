import { describe, expect, it } from 'vitest';
import { LowFpsDetector } from './LowFpsDetector';

const FRAME = 1 / 30;

describe('LowFpsDetector', () => {
  it('fires once after 3 s of sub-45 fps and never again', () => {
    const d = new LowFpsDetector();
    let fired = 0;
    for (let t = 0; t < 10; t += FRAME) if (d.tick(30, FRAME)) fired++;
    expect(fired).toBe(1);
    expect(d.triggered).toBe(true);
    expect(d.tick(10, FRAME)).toBe(false);
  });

  it('does not fire while the frame rate is fine', () => {
    const d = new LowFpsDetector();
    for (let t = 0; t < 20; t += 1 / 60) expect(d.tick(60, 1 / 60)).toBe(false);
    expect(d.belowSec).toBe(0);
  });

  it('a short hitch (< 3 s) resets when fps recovers', () => {
    const d = new LowFpsDetector();
    for (let t = 0; t < 2.5; t += FRAME) d.tick(25, FRAME);
    expect(d.belowSec).toBeGreaterThan(2);
    d.tick(58, FRAME);
    expect(d.belowSec).toBe(0);
    for (let t = 0; t < 2.9; t += FRAME) expect(d.tick(25, FRAME)).toBe(false);
  });

  it('ignores the empty meter (fps = 0) before the first sample', () => {
    const d = new LowFpsDetector();
    for (let t = 0; t < 5; t += FRAME) expect(d.tick(0, FRAME)).toBe(false);
    expect(d.belowSec).toBe(0);
  });

  it('threshold is exclusive: exactly 45 fps counts as fine', () => {
    const d = new LowFpsDetector(45, 1);
    for (let t = 0; t < 3; t += FRAME) expect(d.tick(45, FRAME)).toBe(false);
    let fired = false;
    for (let t = 0; t < 1.5; t += FRAME) fired = d.tick(44, FRAME) || fired;
    expect(fired).toBe(true);
  });

  it('reset arms it again', () => {
    const d = new LowFpsDetector(45, 0.5);
    for (let t = 0; t < 1; t += FRAME) d.tick(20, FRAME);
    expect(d.triggered).toBe(true);
    d.reset();
    expect(d.triggered).toBe(false);
    let fired = false;
    for (let t = 0; t < 1; t += FRAME) fired = d.tick(20, FRAME) || fired;
    expect(fired).toBe(true);
  });
});
