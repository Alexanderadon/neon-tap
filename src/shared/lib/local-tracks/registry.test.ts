import { afterEach, describe, expect, it } from 'vitest';
import { isLocalTrackId, localTrackIds, registerLocalTrackIds, resetLocalTrackIds } from './registry';

describe('local track registry', () => {
  afterEach(() => resetLocalTrackIds());

  it('starts empty and remembers registered ids', () => {
    expect(isLocalTrackId('x')).toBe(false);
    expect(localTrackIds()).toEqual([]);
    registerLocalTrackIds(['x', 'y']);
    registerLocalTrackIds(new Set(['y', 'z']));
    expect(isLocalTrackId('x')).toBe(true);
    expect(isLocalTrackId('z')).toBe(true);
    expect(isLocalTrackId('battle-theme')).toBe(false);
    expect(localTrackIds().sort()).toEqual(['x', 'y', 'z']);
  });

  it('reset clears everything', () => {
    registerLocalTrackIds(['x']);
    resetLocalTrackIds();
    expect(isLocalTrackId('x')).toBe(false);
  });
});
