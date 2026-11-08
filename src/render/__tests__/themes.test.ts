import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/state/schema';
import { THEMES, getTheme, isUnlocked } from '../themes';

describe('gokyuzu temalari', () => {
  it('tema anahtarlari tekildir', () => {
    const keys = THEMES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
