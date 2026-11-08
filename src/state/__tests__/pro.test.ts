import { describe, expect, it } from 'vitest';
import { isProActive, parseProgress } from '../schema';

const pro = (v: unknown) => parseProgress({ pro: v }).pro;

describe('Pro kaydi', () => {
  it('bilinmeyen plan silinir', () => {
    expect(pro({ plan: 'bedava', until: 99 })).toBeNull();
  });

  it('omur boyu planda bitis tarihi yok sayilir', () => {
    expect(pro({ plan: 'lifetime', until: 5 })).toEqual({ plan: 'lifetime', until: null });
  });

  it('bitisi olmayan abonelik sure dolmus sayilir', () => {
    expect(pro({ plan: 'weekly' })).toEqual({ plan: 'weekly', until: 0 });
  });

  it('sonsuz bitis tarihi kabul edilmez', () => {
    expect(pro({ plan: 'monthly', until: Infinity })).toEqual({ plan: 'monthly', until: 0 });
  });

  it('kayit yoksa pro aktif degil', () => {
    expect(isProActive(null)).toBe(false);
  });
});
