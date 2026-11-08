import { describe, expect, it } from 'vitest';
import { alpha, mix, smooth } from '../color';

describe('renk yardimcilari', () => {
  it('mix uclarda kaynak renkleri verir', () => {
    expect(mix('#102030', '#405060', 0)).toBe('#102030');
    expect(mix('#102030', '#405060', 1)).toBe('#405060');
  });

  it('mix ortada yarilar', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('mix bastaki sifirlari korur', () => {
    expect(mix('#000000', '#0000ff', 0.5)).toBe('#000080');
  });

  it('alpha rgba metni uretir', () => {
    expect(alpha('#ff8000', 0.5)).toBe('rgba(255,128,0,0.5)');
  });

  it('smooth sinirlarda 0 ve 1', () => {
    expect(smooth(0, 10, -5)).toBe(0);
    expect(smooth(0, 10, 50)).toBe(1);
  });

  it('smooth ortada yarim', () => {
    expect(smooth(0, 10, 5)).toBe(0.5);
  });
});
