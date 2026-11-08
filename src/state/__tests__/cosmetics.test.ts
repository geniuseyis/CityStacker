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

  it('pro urunu pro ile acilir', () => {
    const gold = skinByKey('gold');
    expect(isOwned(gold, [], false, false)).toBe(false);
    expect(isOwned(gold, [], true, false)).toBe(true);
  });

  it('pro urunu listeye yazilarak acilamaz', () => {
    const gold = skinByKey('gold');
    expect(isOwned(gold, [gold.id], false, false)).toBe(false);
  });

  it('baslangic paketi urunu paketle acilir', () => {
    const copper = skinByKey('copper');
    expect(isOwned(copper, [], false, false)).toBe(false);
    expect(isOwned(copper, [], false, true)).toBe(true);
  });

  it('bilinmeyen kat stili klasige doner', () => {
    expect(skinByKey('yok').key).toBe('classic');
  });

  it('bilinmeyen vinc rengi tema rengine doner', () => {
    expect(craneByKey('yok').key).toBe('theme');
  });
});
