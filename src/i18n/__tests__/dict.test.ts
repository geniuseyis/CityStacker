import { describe, expect, it } from 'vitest';
import { en } from '../en';
import { tr } from '../tr';

const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe('sozlukler', () => {
  it('iki dilde ayni anahtarlar var', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });
});
