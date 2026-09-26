import { describe, expect, it } from 'vitest';
import { common } from './common';

describe('achievement titles', () => {
  it('share one template «Что: N» — a word or two, a colon, the target', () => {
    for (const [family, text] of Object.entries(common.achievements)) {
      expect(text.title, family).toMatch(/^[А-ЯЁA-Z][^:{}]*: \{n\}$/);
      expect('noun' in text, family).toBe(false);
      expect(text.desc.length, family).toBeGreaterThan(0);
    }
  });
});
