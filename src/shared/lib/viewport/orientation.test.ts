import { describe, expect, it } from 'vitest';
import { needsRotateHint, SHORT_VIEWPORT_PX } from './orientation';

describe('needsRotateHint', () => {
  it('phone in landscape (short viewport) → hint', () => {
    expect(needsRotateHint(true, 812, 375)).toBe(true); // iPhone X landscape
    expect(needsRotateHint(true, 844, 390)).toBe(true); // iPhone 14 landscape
    expect(needsRotateHint(true, 780, 360)).toBe(true); // Android landscape
    expect(needsRotateHint(true, 667, 375)).toBe(true); // iPhone SE landscape
  });

  it('phone in portrait → no hint', () => {
    expect(needsRotateHint(true, 375, 812)).toBe(false);
    expect(needsRotateHint(true, 360, 780)).toBe(false);
    expect(needsRotateHint(true, 320, 568)).toBe(false);
  });

  it('tablet landscape (tall enough) → no hint', () => {
    expect(needsRotateHint(true, 1024, 768)).toBe(false); // iPad
    expect(needsRotateHint(true, 1180, 820)).toBe(false); // iPad Air
    expect(needsRotateHint(true, 1024, 600)).toBe(false); // small Android tablet
  });

  it('never on desktop / mouse, whatever the size', () => {
    expect(needsRotateHint(false, 812, 375)).toBe(false);
    expect(needsRotateHint(false, 1280, 400)).toBe(false);
    expect(needsRotateHint(false, 400, 300)).toBe(false);
  });

  it('threshold is exclusive at 500 px and square viewports are not landscape', () => {
    expect(needsRotateHint(true, 900, SHORT_VIEWPORT_PX)).toBe(false);
    expect(needsRotateHint(true, 900, SHORT_VIEWPORT_PX - 1)).toBe(true);
    expect(needsRotateHint(true, 400, 400)).toBe(false);
  });
});
