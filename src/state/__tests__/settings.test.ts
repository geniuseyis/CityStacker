import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from '../schema';

describe('parseSettings', () => {
  it('nesne olmayan kayit varsayilana doner', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('bozuk')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
  });

  it('varsayilan nesneyi paylasmaz', () => {
    expect(parseSettings(null)).not.toBe(DEFAULT_SETTINGS);
  });

  it('gecerli ayarlar aynen korunur', () => {
    const s = { ...DEFAULT_SETTINGS, sound: false, difficulty: 'hard', lang: 'en', guide: true };
    expect(parseSettings(s)).toEqual(s);
  });
});
