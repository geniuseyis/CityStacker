// Gökyüzü temaları. Her tema yükseklikle (alt 0 -> 1) değişen bir gökyüzü taşır.

export type BlockPalette = {
  face: string; // ön yüz üst
  faceLow: string; // ön yüz alt
  side: string; // sağ yan yüz
  slab: string; // döşeme bandı
};

export type SkyTheme = {
  key: string;
  unlockFloors: number;
  // [üst, alt] — yerde ve tepede
  skyLow: [string, string];
  skyHigh: [string, string];
  sun: string | null;
  far: string;
  mid: string;
  near: string;
  nearWindow: string;
  ground: string;
  groundEdge: string;
  glass: [string, string];
  lit: [string, string];
  blocks: BlockPalette[];
  crane: string;
  craneDark: string;
  cable: string;
  stars: boolean;
  accent: string;
};

export const THEMES: SkyTheme[] = [
  {
    key: 'dusk',
    unlockFloors: 0,
    skyLow: ['#2B2D6E', '#F4A77E'],
    skyHigh: ['#070A22', '#2A3486'],
    sun: '#FFC9A1',
    far: '#6F5E9E',
    mid: '#47407A',
    near: '#272653',
    nearWindow: '#FFC98F',
    ground: '#14142E',
    groundEdge: '#FF8A5C',
    glass: ['#262B52', '#3A4378'],
    lit: ['#FFE2B3', '#FFB870'],
    blocks: [
      { face: '#EFE9DF', faceLow: '#D8CFC1', side: '#B5AA9A', slab: '#FFFFFF' },
      { face: '#E58A6B', faceLow: '#CC6F52', side: '#A5553F', slab: '#F7B79F' },
      { face: '#A9C3B2', faceLow: '#8DAA97', side: '#6E8A78', slab: '#D4E5D9' },
      { face: '#7A8CC6', faceLow: '#6274AE', side: '#4B5A8C', slab: '#B3C0EA' },
    ],
    crane: '#FFB547',
    craneDark: '#C9832A',
    cable: '#1B1B33',
    stars: true,
    accent: '#FF8A5C',
  },
  {
    key: 'dawn',
    unlockFloors: 15,
    skyLow: ['#8FB8F2', '#FCE3CF'],
    skyHigh: ['#3B6FD1', '#9CC6F5'],
    sun: '#FFF4E2',
    far: '#B9C8E6',
    mid: '#94A8D3',
    near: '#6C80B4',
    nearWindow: '#FFF1C9',
    ground: '#3D4A72',
    groundEdge: '#FFD37A',
    glass: ['#5D7DB8', '#8FB0E3'],
    lit: ['#FFF6DA', '#FFE09A'],
    blocks: [
      { face: '#FFFFFF', faceLow: '#E8ECF3', side: '#C4CCDA', slab: '#FFFFFF' },
      { face: '#F2C6A9', faceLow: '#E2AC8C', side: '#C28C6C', slab: '#FFE3D1' },
      { face: '#D7E3EF', faceLow: '#BCCDE0', side: '#97ABC4', slab: '#F4F8FC' },
      { face: '#F4DE9A', faceLow: '#E3C877', side: '#C2A658', slab: '#FFF2C8' },
    ],
    crane: '#FF7A45',
    craneDark: '#C85A2E',
    cable: '#2B3557',
    stars: false,
    accent: '#FF7A45',
  },
  {
    key: 'night',
    unlockFloors: 30,
    skyLow: ['#0A0F2C', '#25305F'],
    skyHigh: ['#020309', '#0B1030'],
    sun: null,
    far: '#1E2550',
    mid: '#151B3E',
    near: '#0C1029',
    nearWindow: '#FFD27D',
    ground: '#05070F',
    groundEdge: '#5B7CFF',
    glass: ['#0E1430', '#1A2350'],
    lit: ['#FFE6A8', '#FFC15E'],
    blocks: [
      { face: '#3A4270', faceLow: '#2C3359', side: '#1E2442', slab: '#5A6497' },
      { face: '#4B3E6E', faceLow: '#3A2F57', side: '#281F3E', slab: '#6E5F97' },
      { face: '#2F5162', faceLow: '#243F4D', side: '#182C36', slab: '#4C7487' },
      { face: '#5A4A3A', faceLow: '#45382B', side: '#30271E', slab: '#7D6A55' },
    ],
    crane: '#FFC15E',
    craneDark: '#B98632',
    cable: '#7781A8',
    stars: true,
    accent: '#5B7CFF',
  },
  {
    key: 'neon',
    unlockFloors: 50,
    skyLow: ['#12021F', '#4A1060'],
    skyHigh: ['#030008', '#1B0533'],
    sun: '#FF3CAC',
    far: '#3B0F56',
    mid: '#280A40',
    near: '#16062A',
    nearWindow: '#00F0FF',
    ground: '#09020F',
    groundEdge: '#FF3CAC',
    glass: ['#1A0F33', '#2A1650'],
    lit: ['#9BFBFF', '#00E0F0'],
    blocks: [
      { face: '#26183F', faceLow: '#1C1130', side: '#120A20', slab: '#FF3CAC' },
      { face: '#1B2240', faceLow: '#131832', side: '#0B0F22', slab: '#00F0FF' },
      { face: '#2A1438', faceLow: '#1F0E2A', side: '#14081C', slab: '#B26BFF' },
      { face: '#14283A', faceLow: '#0E1D2B', side: '#08121C', slab: '#3DFFB0' },
    ],
    crane: '#FF3CAC',
    craneDark: '#A8226F',
    cable: '#B26BFF',
    stars: true,
    accent: '#FF3CAC',
  },
];

export function getTheme(key: string): SkyTheme {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}

export function isUnlocked(t: SkyTheme, bestFloors: number) {
  return bestFloors >= t.unlockFloors;
}
