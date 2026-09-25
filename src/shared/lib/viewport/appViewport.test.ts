import { describe, expect, it } from 'vitest';
import { isTextField, visibleBox } from './appViewport';

describe('visibleBox', () => {
  it('follows the visual viewport: an in-app toolbar or a mobile bar makes it shorter than the layout', () => {
    expect(visibleBox({ offsetTop: 0, height: 700.4, scale: 1 }, 844, false)).toEqual({ top: 0, height: 700 });
    expect(visibleBox({ offsetTop: 52, height: 690, scale: 1 }, 844, false)).toEqual({ top: 52, height: 690 });
  });

  it('falls back to the inner height without visualViewport', () => {
    expect(visibleBox(null, 667, false)).toEqual({ top: 0, height: 667 });
    expect(visibleBox(undefined, 0, false)).toBeNull();
  });

  it('keeps the current box while typing and while pinch-zoomed', () => {
    expect(visibleBox({ offsetTop: 300, height: 400, scale: 1 }, 844, true)).toBeNull();
    expect(visibleBox({ offsetTop: 120, height: 420, scale: 2 }, 844, false)).toBeNull();
    expect(visibleBox({ offsetTop: 0, height: 0, scale: 1 }, 844, false)).toBeNull();
  });
});

describe('isTextField', () => {
  it('text inputs, textareas and editable elements take typing; buttons, toggles, sliders and file inputs do not', () => {
    expect(isTextField({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTextField({ tagName: 'INPUT' })).toBe(true);
    expect(isTextField({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextField({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTextField({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(isTextField({ tagName: 'INPUT', type: 'file' })).toBe(false);
    expect(isTextField({ tagName: 'BUTTON' })).toBe(false);
    expect(isTextField(null)).toBe(false);
  });
});
