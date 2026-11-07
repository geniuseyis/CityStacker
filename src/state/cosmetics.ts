// Kozmetik kataloğu. Fiyatlar jeton cinsinden; bazıları Pro'ya ya da başlangıç
// paketine özel. Görünüşleri render/floors.ts ve render/scene.ts çiziyor.

export type Unlock = { tokens: number } | { pro: true } | { starter: true } | { free: true };

export type Skin = { id: string; key: string; unlock: Unlock };
export type CraneColor = { id: string; key: string; color: string | null; dark: string | null; unlock: Unlock };

export const SKINS: Skin[] = [
  { id: 'skin.classic', key: 'classic', unlock: { free: true } },
  { id: 'skin.glass', key: 'glass', unlock: { tokens: 40 } },
  { id: 'skin.brick', key: 'brick', unlock: { tokens: 40 } },
  { id: 'skin.timber', key: 'timber', unlock: { tokens: 50 } },
  { id: 'skin.neon', key: 'neon', unlock: { tokens: 60 } },
  { id: 'skin.copper', key: 'copper', unlock: { starter: true } },
  { id: 'skin.gold', key: 'gold', unlock: { pro: true } },
];

export const CRANES: CraneColor[] = [
  { id: 'crane.theme', key: 'theme', color: null, dark: null, unlock: { free: true } },
  { id: 'crane.red', key: 'red', color: '#E5484D', dark: '#A8282C', unlock: { tokens: 15 } },
  { id: 'crane.teal', key: 'teal', color: '#2EC4B6', dark: '#1B8C82', unlock: { tokens: 15 } },
  { id: 'crane.white', key: 'white', color: '#E8ECF2', dark: '#A9B0BD', unlock: { tokens: 15 } },
  { id: 'crane.graphite', key: 'graphite', color: '#4A505E', dark: '#2A2E37', unlock: { tokens: 20 } },
];

export function isOwned(item: { id: string; unlock: Unlock }, owned: string[], pro: boolean, starter: boolean) {
  const u = item.unlock;
  if ('free' in u) return true;
  if ('pro' in u) return pro;
  if ('starter' in u) return starter;
  return owned.includes(item.id);
}

export const skinByKey = (key: string) => SKINS.find((s) => s.key === key) ?? SKINS[0];
export const craneByKey = (key: string) => CRANES.find((c) => c.key === key) ?? CRANES[0];
