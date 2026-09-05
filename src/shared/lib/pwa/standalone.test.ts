import { describe, expect, it } from 'vitest';
import { installStandaloneGuards, isMultiTouch, isStandaloneDisplay, isZoomShortcut, isZoomWheel } from './standalone';

describe('standalone guards — decisions', () => {
  it('ctrl/cmd + plus/minus/equals/zero are zoom shortcuts', () => {
    for (const key of ['+', '-', '=', '0', 'Add', 'Subtract']) {
      expect(isZoomShortcut({ key, ctrlKey: true, metaKey: false })).toBe(true);
      expect(isZoomShortcut({ key, ctrlKey: false, metaKey: true })).toBe(true);
      expect(isZoomShortcut({ key, ctrlKey: false, metaKey: false })).toBe(false);
    }
    // Game keys with a modifier held are not zoom.
    expect(isZoomShortcut({ key: 'f', ctrlKey: true, metaKey: false })).toBe(false);
    expect(isZoomShortcut({ key: 'r', ctrlKey: true, metaKey: false })).toBe(false);
  });

  it('ctrl+wheel zooms, plain wheel scrolls', () => {
    expect(isZoomWheel({ ctrlKey: true })).toBe(true);
    expect(isZoomWheel({ ctrlKey: false })).toBe(false);
  });

  it('two fingers = pinch, one finger = play', () => {
    expect(isMultiTouch(0)).toBe(false);
    expect(isMultiTouch(1)).toBe(false);
    expect(isMultiTouch(2)).toBe(true);
  });

  it('is safe outside a browser', () => {
    expect(isStandaloneDisplay()).toBe(false);
    expect(typeof installStandaloneGuards()).toBe('function');
  });
});
