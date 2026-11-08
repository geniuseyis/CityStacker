import { describe, expect, it } from 'vitest';
import { CRANES, SKINS, craneByKey, isOwned, skinByKey } from '../cosmetics';
import { DEFAULT_SETTINGS } from '../schema';

describe('kozmetik', () => {
  it('ucretsiz urun her zaman sahiplidir', () => {
    expect(isOwned(SKINS[0], [], false, false)).toBe(true);
  });
});
