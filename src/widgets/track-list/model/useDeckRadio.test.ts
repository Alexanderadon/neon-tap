import { describe, expect, it } from 'vitest';
import { saveDataOn } from './useDeckRadio';

describe('deck radio', () => {
  it('stays silent with the browser data saver on', () => {
    expect(saveDataOn({ connection: { saveData: true } })).toBe(true);
    expect(saveDataOn({ connection: { saveData: false } })).toBe(false);
    expect(saveDataOn({})).toBe(false);
    expect(saveDataOn(undefined)).toBe(false);
  });
});
