import { describe, expect, it } from 'vitest';
import { isProActive, parseProgress } from '../schema';

const pro = (v: unknown) => parseProgress({ pro: v }).pro;

describe('Pro kaydi', () => {
  it('bilinmeyen plan silinir', () => {
    expect(pro({ plan: 'bedava', until: 99 })).toBeNull();
  });
});
