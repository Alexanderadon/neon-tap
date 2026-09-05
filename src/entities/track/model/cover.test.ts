import { describe, expect, it } from 'vitest';
import { GENRES } from '@/shared/types/chart';
import { COVER_PALETTES, coverSpec, hashId, isGenre, seededRandom } from './cover';

describe('cover model', () => {
  it('hashes ids deterministically and distinctly', () => {
    expect(hashId('midnight-drive')).toBe(hashId('midnight-drive'));
    expect(hashId('midnight-drive')).not.toBe(hashId('midnight-drivf'));
    expect(Number.isInteger(hashId('x'))).toBe(true);
  });

  it('seeded PRNG is reproducible and in [0, 1)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has a palette and a motif for every genre', () => {
    for (const g of GENRES) {
      expect(COVER_PALETTES[g]).toBeDefined();
      const spec = coverSpec('t', g);
      expect(spec.genre).toBe(g);
      expect(spec.shapes.length).toBeGreaterThan(0);
      for (const s of spec.shapes) {
        const vals = Object.values(s).filter((v): v is number => typeof v === 'number');
        for (const v of vals) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('same id + genre → identical spec; different ids differ', () => {
    const a = coverSpec('black-diamond', 'dnb');
    const b = coverSpec('black-diamond', 'dnb');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = coverSpec('final-hour', 'dnb');
    expect(JSON.stringify(c.shapes)).not.toBe(JSON.stringify(a.shapes));
    const d = coverSpec('black-diamond', 'techno');
    expect(d.seed).not.toBe(a.seed);
  });

  it('falls back to a default genre for unknown / missing genres', () => {
    expect(isGenre('rock')).toBe(true);
    expect(isGenre('polka')).toBe(false);
    expect(coverSpec('custom', undefined).genre).toBe('electronic');
    expect(coverSpec('custom', 'polka' as never).genre).toBe('electronic');
  });
});
