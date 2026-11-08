import { describe, expect, it } from 'vitest';
import { clamp, dcos, dsin, nextRandom, seedFromString } from '../math';

describe('matematik', () => {
  it('dsin genis aralikta Math.sin ile uyusur', () => {
    for (let x = -20; x <= 20; x += 0.137) expect(dsin(x)).toBeCloseTo(Math.sin(x), 8);
  });

  it('dsin sifirda sifir', () => {
    expect(dsin(0)).toBe(0);
  });

  it('dsin tek fonksiyondur', () => {
    expect(dsin(-1.2)).toBeCloseTo(-dsin(1.2), 12);
  });

  it('dcos Math.cos ile uyusur', () => {
    for (let x = -10; x <= 10; x += 0.211) expect(dcos(x)).toBeCloseTo(Math.cos(x), 8);
  });

  it('clamp alt sinira ceker', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamp ust sinira ceker', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('clamp araliktaki degeri korur', () => {
    expect(clamp(7, 0, 10)).toBe(7);
  });

  it('rastgele sayi 0-1 araliginda', () => {
    const st = { rng: 7 };
    for (let i = 0; i < 2000; i++) {
      const v = nextRandom(st);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('ayni durum ayni diziyi uretir', () => {
    const a = { rng: 99 };
    const b = { rng: 99 };
    for (let i = 0; i < 50; i++) expect(nextRandom(a)).toBe(nextRandom(b));
  });

  it('rastgele sayi durumu ilerletir', () => {
    const st = { rng: 1 };
    nextRandom(st);
    expect(st.rng).not.toBe(1);
  });

  it('bos metnin seedi FNV baslangicidir', () => {
    expect(seedFromString('')).toBe(0x811c9dc5);
  });

  it('seed isaretsiz 32 bit', () => {
    for (const s of ['a', 'kule', '2026-11-08', 'ğüşıöç']) {
      const h = seedFromString(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
