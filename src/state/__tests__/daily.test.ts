import { describe, expect, it } from 'vitest';
import { seedFromString } from '@/engine';
import { dailySeed, todayKey } from '../daily';

describe('gunluk kule', () => {
  it('gun anahtari sifirla doldurulur', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('aralik ayi 12 olarak yazilir', () => {
    expect(todayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});
