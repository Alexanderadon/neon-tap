import { describe, expect, it } from 'vitest';
import { formatDate } from './format';

describe('history format', () => {
  it('formats dates leniently', () => {
    expect(formatDate('garbage')).toBe('');
    expect(formatDate('2025-09-05T11:07:00Z')).toMatch(/\d{2}\.\d{2}, \d{2}:\d{2}/);
  });
});
