import { describe, expect, it } from 'vitest';
import { clamp, dcos, dsin, nextRandom, seedFromString } from '../math';

describe('matematik', () => {
  it('dsin genis aralikta Math.sin ile uyusur', () => {
    for (let x = -20; x <= 20; x += 0.137) expect(dsin(x)).toBeCloseTo(Math.sin(x), 8);
  });
});
