import { describe, expect, it } from 'vitest';
import { fmt, plural } from './index';

describe('i18n', () => {
  it('interpolates placeholders', () => {
    expect(fmt('нужно {n} ★', { n: 8 })).toBe('нужно 8 ★');
  });

  it('picks russian plural forms', () => {
    const forms = ['нота', 'ноты', 'нот'] as const;
    expect(plural(1, forms)).toBe('нота');
    expect(plural(2, forms)).toBe('ноты');
    expect(plural(5, forms)).toBe('нот');
    expect(plural(11, forms)).toBe('нот');
    expect(plural(21, forms)).toBe('нота');
  });
});
