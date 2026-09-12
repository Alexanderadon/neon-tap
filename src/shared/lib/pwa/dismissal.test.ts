import { describe, expect, it } from 'vitest';
import { parseDismissedAt, serializeDismissedAt } from './dismissal';

describe('install dismissal storage format', () => {
  it('round-trips a timestamp', () => {
    const now = 1_800_000_000_123;
    expect(parseDismissedAt(serializeDismissedAt(now))).toBe(now);
    expect(serializeDismissedAt(1234.9)).toBe('1234');
  });

  it('treats missing or malformed values as "never dismissed"', () => {
    expect(parseDismissedAt(null)).toBeNull();
    expect(parseDismissedAt(undefined)).toBeNull();
    expect(parseDismissedAt('')).toBeNull();
    expect(parseDismissedAt('yes')).toBeNull();
    expect(parseDismissedAt('{"at":1}')).toBeNull();
    expect(parseDismissedAt('-5')).toBeNull();
    expect(parseDismissedAt('0')).toBeNull();
    expect(parseDismissedAt('1e12')).toBeNull();
    expect(parseDismissedAt(' 1800000000000 ')).toBe(1_800_000_000_000);
  });

  it('refuses to serialise nonsense', () => {
    expect(() => serializeDismissedAt(NaN)).toThrow(/timestamp/);
    expect(() => serializeDismissedAt(-1)).toThrow(/timestamp/);
  });
});
