import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/state/schema';
import { THEMES, getTheme, isUnlocked } from '../themes';

describe('gokyuzu temalari', () => {
  it('tema anahtarlari tekildir', () => {
    const keys = THEMES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('varsayilan tema katalogda ve acik', () => {
    const t = getTheme(DEFAULT_SETTINGS.theme);
    expect(t.key).toBe(DEFAULT_SETTINGS.theme);
    expect(isUnlocked(t, 0)).toBe(true);
  });

  it('bilinmeyen tema ilk temaya doner', () => {
    expect(getTheme('yok')).toBe(THEMES[0]);
  });

  it('kat rekoru dolunca tema acilir', () => {
    const locked = THEMES.find((t) => t.unlockFloors > 0)!;
    expect(isUnlocked(locked, locked.unlockFloors - 1)).toBe(false);
    expect(isUnlocked(locked, locked.unlockFloors)).toBe(true);
  });

  it('her temada kat paleti var', () => {
    for (const t of THEMES) expect(t.blocks.length).toBeGreaterThan(0);
  });
});
