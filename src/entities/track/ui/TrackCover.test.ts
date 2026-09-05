import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GENRES } from '@/shared/types/chart';
import { TrackCover } from './TrackCover';

const render = (id: string, genre?: (typeof GENRES)[number]) => renderToStaticMarkup(createElement(TrackCover, { id, genre, size: 64 }));

describe('TrackCover', () => {
  it('renders identical markup for the same id', () => {
    expect(render('midnight-drive', 'synthwave')).toBe(render('midnight-drive', 'synthwave'));
  });

  it('renders different markup for different ids', () => {
    expect(render('midnight-drive', 'synthwave')).not.toBe(render('virtual-rush', 'synthwave'));
  });

  it('renders every genre as an inline SVG with a background and shapes', () => {
    for (const g of GENRES) {
      const html = render('t', g);
      expect(html.startsWith('<svg')).toBe(true);
      expect(html).toContain(`data-genre="${g}"`);
      expect(html).toContain('<linearGradient');
      expect((html.match(/<(rect|circle|path|line)\b/g) ?? []).length).toBeGreaterThan(2);
    }
  });

  it('works without a genre (user songs) and honours size', () => {
    const html = render('custom-song');
    expect(html).toContain('data-genre="electronic"');
    expect(html).toContain('width:64px');
  });
});
