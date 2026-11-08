import { describe, expect, it } from 'vitest';
import { CRANES, SKINS, craneByKey, isOwned, skinByKey } from '../cosmetics';
import { DEFAULT_SETTINGS } from '../schema';

describe('kozmetik', () => {
  it('ucretsiz urun her zaman sahiplidir', () => {
    expect(isOwned(SKINS[0], [], false, false)).toBe(true);
  });

  it('jetonlu urun satin alinmadan sahipli degil', () => {
    const glass = skinByKey('glass');
    expect(isOwned(glass, [], true, true)).toBe(false);
    expect(isOwned(glass, [glass.id], false, false)).toBe(true);
  });
});
