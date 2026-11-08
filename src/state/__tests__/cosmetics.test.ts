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

  it('kimlikler tekildir', () => {
    const ids = [...SKINS, ...CRANES].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('kimlikler kayit kuralina uyar', () => {
    for (const x of [...SKINS, ...CRANES]) expect(x.id).toMatch(/^[a-z0-9.]{1,40}$/);
  });

  it('varsayilan ayarlar katalogda vardir', () => {
    expect(skinByKey(DEFAULT_SETTINGS.skin).key).toBe(DEFAULT_SETTINGS.skin);
    expect(craneByKey(DEFAULT_SETTINGS.crane).key).toBe(DEFAULT_SETTINGS.crane);
  });

  it('vinc renkleri gecerli hex', () => {
    for (const c of CRANES.filter((x) => x.color)) {
      expect(c.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(c.dark).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
