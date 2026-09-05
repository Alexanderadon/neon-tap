import { describe, expect, it } from 'vitest';
import { LANE_COLORS } from '@/shared/config/constants';
import { DEFAULT_THEME, PALETTE_SIZE, SYNTHWAVE, THEMES, hashId, themeById, themeFor, themeForGenre } from './themes';

const HEX = /^#[0-9a-f]{6}$/i;
const MOTIFS = ['grid', 'rings', 'bars', 'haze'];

describe('themes', () => {
  it('has 6–8 complete themes with unique ids and valid colours', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(6);
    expect(THEMES.length).toBeLessThanOrEqual(8);
    const ids = new Set(THEMES.map((t) => t.id));
    expect(ids.size).toBe(THEMES.length);
    for (const t of THEMES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.bg).toHaveLength(2);
      expect(t.bg[0]).toMatch(HEX);
      expect(t.bg[1]).toMatch(HEX);
      expect(t.laneColors.length).toBeGreaterThanOrEqual(PALETTE_SIZE);
      expect(t.laneColors.length).toBeLessThanOrEqual(6);
      for (const c of t.laneColors) expect(c).toMatch(HEX);
      expect(t.accent).toMatch(HEX);
      expect(t.glow).toMatch(HEX);
      expect(MOTIFS).toContain(t.motif);
    }
  });

  it('covers every requested genre family', () => {
    for (const g of ['synthwave', 'chiptune', 'lofi', 'rock', 'orchestral', 'jazz', 'techno', 'ambient']) {
      expect(themeById(g), g).toBeDefined();
    }
  });

  it('default theme reproduces the original lane palette', () => {
    expect(DEFAULT_THEME).toBe(SYNTHWAVE);
    expect([...SYNTHWAVE.laneColors]).toEqual([...LANE_COLORS]);
    expect(SYNTHWAVE.bg).toEqual(['#05060a', '#05060a']);
    expect(SYNTHWAVE.accent).toBe('#00f0ff');
    expect(SYNTHWAVE.motif).toBe('grid');
  });

  it('maps genre spellings, aliases and compound tags', () => {
    expect(themeForGenre('Synthwave')?.id).toBe('synthwave');
    expect(themeForGenre('drum & bass')?.id).toBe('techno');
    expect(themeForGenre('DnB')?.id).toBe('techno');
    expect(themeForGenre('Lo-Fi hip hop')?.id).toBe('lofi');
    expect(themeForGenre('8-bit')?.id).toBe('chiptune');
    expect(themeForGenre('hard rock')?.id).toBe('rock');
    expect(themeForGenre('Cinematic orchestral')?.id).toBe('orchestral');
    expect(themeForGenre('acoustic')?.id).toBe('ambient');
    expect(themeForGenre('polka')).toBeUndefined();
    expect(themeForGenre('')).toBeUndefined();
    expect(themeForGenre(undefined)).toBeUndefined();
  });

  it('themeFor is deterministic and always returns a theme', () => {
    const ids = ['achilles', 'silver-bullet', 'technological-menace', 'custom-123', ''];
    for (const id of ids) {
      const a = themeFor(undefined, id);
      const b = themeFor(null, id);
      expect(a).toBe(b);
      expect(THEMES).toContain(a);
    }
    expect(themeFor('jazz', 'achilles').id).toBe('jazz');
    expect(themeFor('nonsense-genre', 'achilles')).toBe(themeFor(undefined, 'achilles'));
  });

  it('id hash is stable and spreads ids over the themes', () => {
    expect(hashId('achilles')).toBe(hashId('achilles'));
    expect(hashId('a')).not.toBe(hashId('b'));
    const picked = new Set<string>();
    for (let i = 0; i < 200; i++) picked.add(themeFor(undefined, `track-${i}`).id);
    expect(picked.size).toBeGreaterThanOrEqual(THEMES.length - 1);
  });
});
