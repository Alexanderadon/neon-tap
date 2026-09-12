import { describe, expect, it } from 'vitest';
import { buildHash, collectPrecache, injectManifest, normalizeDistPath } from './sw-manifest';

const SW = [
  "const BUILD = '__NEON_BUILD__';",
  'const PRECACHE = /* __NEON_PRECACHE__ */ [];',
  'self.addEventListener("install", () => {});',
].join('\n');

describe('collectPrecache', () => {
  it('keeps the app shell only', () => {
    const urls = collectPrecache([
      'index.html',
      'manifest.webmanifest',
      'privacy.html',
      'sw.js',
      'assets/index-BDWu33SF.js',
      'assets/index-BTtlhb2c.css',
      'assets/analysis.worker-BuI2VLeA.js',
      'assets/react-BdZgHC1P.js',
      'icons/icon.svg',
      'icons/icon-512.png',
      'music/achilles.mp3',
      'charts/catalog.json',
      'sfx/hit-1.mp3',
      'voice/dmitry/mimo.mp3',
      '.well-known/assetlinks.json',
    ]);
    expect(urls).toEqual([
      '/',
      '/assets/analysis.worker-BuI2VLeA.js',
      '/assets/index-BDWu33SF.js',
      '/assets/index-BTtlhb2c.css',
      '/assets/react-BdZgHC1P.js',
      '/icons/icon.svg',
      '/index.html',
      '/manifest.webmanifest',
      '/privacy.html',
    ]);
  });

  it('normalises windows paths and dedupes', () => {
    expect(normalizeDistPath('.\\assets\\a.js')).toBe('assets/a.js');
    expect(collectPrecache(['assets\\a.js', './assets/a.js', 'index.html', 'index.html'])).toEqual(['/', '/assets/a.js', '/index.html']);
  });

  it('never precaches sw.js itself or nested asset dirs', () => {
    expect(collectPrecache(['sw.js', 'assets/deep/x.js', 'assets/map.js.map'])).toEqual([]);
  });
});

describe('buildHash', () => {
  it('is deterministic and order-independent', () => {
    const a = buildHash([
      { path: '/a.js', content: 'aaa' },
      { path: '/b.css', content: new Uint8Array([1, 2, 3]) },
    ]);
    const b = buildHash([
      { path: '/b.css', content: new Uint8Array([1, 2, 3]) },
      { path: '/a.js', content: 'aaa' },
    ]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it('changes when content or a path changes', () => {
    const base = buildHash([{ path: '/a.js', content: 'aaa' }]);
    expect(buildHash([{ path: '/a.js', content: 'aab' }])).not.toBe(base);
    expect(buildHash([{ path: '/b.js', content: 'aaa' }])).not.toBe(base);
    expect(buildHash([])).not.toBe(base);
  });
});

describe('injectManifest', () => {
  it('replaces both placeholders with valid JS', () => {
    const out = injectManifest(SW, ['/', '/assets/index-abc.js'], 'deadbeef0123');
    expect(out).toContain("const BUILD = 'deadbeef0123';");
    expect(out).toContain('const PRECACHE = ["/","/assets/index-abc.js"];');
    expect(out).not.toContain('__NEON_');
    // The injected source stays parseable.
    expect(() => new Function(out.replace(/^self\./gm, 'globalThis.'))).not.toThrow();
  });

  it('tolerates whitespace variations of the precache placeholder', () => {
    const src = 'const PRECACHE = /*__NEON_PRECACHE__*/  [];\nconst BUILD="__NEON_BUILD__";';
    expect(injectManifest(src, ['/'], 'abcdef')).toBe('const PRECACHE = ["/"];\nconst BUILD="abcdef";');
  });

  it('rejects missing or duplicated placeholders and bad input', () => {
    expect(() => injectManifest('const x = 1;', ['/'], 'abcdef')).toThrow(/__NEON_PRECACHE__/);
    expect(() => injectManifest(SW + SW, ['/'], 'abcdef')).toThrow(/exactly one/);
    expect(() => injectManifest(SW, ['/'], 'not-hex!')).toThrow(/hash/);
    expect(() => injectManifest(SW, ['assets/x.js'], 'abcdef')).toThrow(/absolute/);
  });
});
