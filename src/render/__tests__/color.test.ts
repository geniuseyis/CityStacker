import { describe, expect, it } from 'vitest';
import { alpha, mix, smooth } from '../color';

describe('renk yardimcilari', () => {
  it('mix uclarda kaynak renkleri verir', () => {
    expect(mix('#102030', '#405060', 0)).toBe('#102030');
    expect(mix('#102030', '#405060', 1)).toBe('#405060');
  });
});
