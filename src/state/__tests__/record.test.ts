import { describe, expect, it } from 'vitest';
import { parseProgress, parseRecord } from '../schema';

const rec = (over: object = {}) => ({
  v: 5,
  seed: 42,
  difficulty: 'normal',
  weather: 'clear',
  inputs: [
    { tick: 10, kind: 'drop' },
    { tick: 20, kind: 'drop' },
  ],
  score: 100,
  floors: 2,
  ...over,
});

describe('parseRecord', () => {
  it('gecerli kayit okunur', () => {
    expect(parseRecord(rec())).toEqual(rec());
  });

  it('eski surum kayit reddedilir', () => {
    expect(parseRecord(rec({ v: 1 }))).toBeNull();
  });

  it('liste olmayan girdiler reddedilir', () => {
    expect(parseRecord(rec({ inputs: 'x' }))).toBeNull();
  });

  it('cok uzun kayit reddedilir', () => {
    const inputs = Array.from({ length: 3001 }, (_, i) => ({ tick: i, kind: 'drop' }));
    expect(parseRecord(rec({ inputs }))).toBeNull();
  });

  it('bilinmeyen hava reddedilir', () => {
    expect(parseRecord(rec({ weather: 'kar' }))).toBeNull();
  });

  it('bilinmeyen girdi turu reddedilir', () => {
    expect(parseRecord(rec({ inputs: [{ tick: 1, kind: 'hile' }] }))).toBeNull();
  });

  it('geriye giden adim reddedilir', () => {
    expect(parseRecord(rec({ inputs: [{ tick: 9, kind: 'drop' }, { tick: 3, kind: 'drop' }] }))).toBeNull();
  });

  it('negatif adim sifira cekilir', () => {
    expect(parseRecord(rec({ inputs: [{ tick: -4, kind: 'drop' }] }))?.inputs[0].tick).toBe(0);
  });

  it('sayi olmayan adim reddedilir', () => {
    expect(parseRecord(rec({ inputs: [{ tick: 'a', kind: 'drop' }] }))).toBeNull();
  });

  it('ayni adimda iki girdi kabul edilir', () => {
    const inputs = [{ tick: 5, kind: 'continue' }, { tick: 5, kind: 'drop' }];
    expect(parseRecord(rec({ inputs }))?.inputs).toHaveLength(2);
  });
});
