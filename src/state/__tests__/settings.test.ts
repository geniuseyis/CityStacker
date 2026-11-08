import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from '../schema';

describe('parseSettings', () => {
  it('nesne olmayan kayit varsayilana doner', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('bozuk')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
  });
});
