import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Heart } from './Heart';

const html = (state: 'on' | 'off' | 'gold') => renderToStaticMarkup(createElement(Heart, { state }));

describe('Heart', () => {
  it('draws a life past five gold with the dark-orange rim and a halo — inside the SVG, no filters', () => {
    const out = html('gold');
    expect(out).toContain('heart-gold');
    expect(out).toContain('#ffd23f');
    expect(out).toContain('stroke="#8a4500"');
    expect(out).toContain('<radialGradient');
    expect(out).not.toContain('filter');
  });

  it('keeps the white and the lost heart without gold or halo', () => {
    for (const state of ['on', 'off'] as const) {
      const out = html(state);
      expect(out).not.toContain('#ffd23f');
      expect(out).not.toContain('radialGradient');
      expect(out).toContain('stroke="#000"');
    }
  });
});
