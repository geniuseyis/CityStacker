import { describe, expect, it } from 'vitest';
import { en } from '../en';
import { tr } from '../tr';

const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe('sozlukler', () => {
  it('iki dilde ayni anahtarlar var', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });

  it('degiskenler iki dilde ayni', () => {
    for (const k of Object.keys(tr) as (keyof typeof tr)[]) expect([k, vars(en[k])]).toEqual([k, vars(tr[k])]);
  });
});
