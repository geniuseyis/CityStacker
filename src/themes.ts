export type Theme = {
  key: string;
  label: string;
  emoji: string;
  sky: [string, string]; // [üst, alt]
  bgFar: string;
  bgNear: string;
  bgFarOpacity: number;
  bgNearOpacity: number;
  bgWindow: string;
  ground: string;
  groundBorder: string;
  street: string;
  blocks: [string, string][];
  windowLit: string;
  windowDark: string;
};

export const THEMES: Theme[] = [
  {
    key: 'gunduz',
    label: 'Gündüz',
    emoji: '☀️',
    sky: ['#1a6fd4', '#7cc0f5'],
    bgFar: '#2f6fb0',
    bgNear: '#234e82',
    bgFarOpacity: 0.55,
    bgNearOpacity: 0.85,
    bgWindow: 'rgba(255,255,255,0.5)',
    ground: '#0c1a30',
    groundBorder: '#234e82',
    street: '#ffd54a',
    blocks: [
      ['#ff8a3d', '#d2641f'],
      ['#ffb347', '#e08a1e'],
      ['#ff9f3d', '#d97a1c'],
      ['#f5852a', '#c4611a'],
    ],
    windowLit: 'rgba(255,238,180,0.95)',
    windowDark: 'rgba(60,30,8,0.55)',
  },
  {
    key: 'gece',
    label: 'Gece',
    emoji: '🌙',
    sky: ['#070b22', '#1b2c5a'],
    bgFar: '#16204a',
    bgNear: '#0e1838',
    bgFarOpacity: 0.7,
    bgNearOpacity: 0.95,
    bgWindow: 'rgba(255,220,140,0.75)',
    ground: '#04070f',
    groundBorder: '#1b2c5a',
    street: '#3a4a7a',
    blocks: [
      ['#5ad1c4', '#2fa89a'],
      ['#7c9cff', '#5570e0'],
      ['#b388ff', '#8a5cf0'],
      ['#5aa8e2', '#3461b8'],
    ],
    windowLit: 'rgba(190,235,255,0.95)',
    windowDark: 'rgba(10,20,40,0.6)',
  },
  {
    key: 'gunbatimi',
    label: 'Gün Batımı',
    emoji: '🌇',
    sky: ['#5b2a86', '#ff9a6b'],
    bgFar: '#7a3b86',
    bgNear: '#4a2360',
    bgFarOpacity: 0.5,
    bgNearOpacity: 0.85,
    bgWindow: 'rgba(255,210,150,0.6)',
    ground: '#2a1530',
    groundBorder: '#5b2a86',
    street: '#ffd54a',
    blocks: [
      ['#ff8a3d', '#d2641f'],
      ['#ff6b9d', '#e04578'],
      ['#ffd54a', '#e0a32a'],
      ['#ff5a5a', '#d23a3a'],
    ],
    windowLit: 'rgba(255,230,180,0.95)',
    windowDark: 'rgba(60,20,40,0.55)',
  },
  {
    key: 'neon',
    label: 'Neon',
    emoji: '🌃',
    sky: ['#05030f', '#1a0a3a'],
    bgFar: '#2a1060',
    bgNear: '#160838',
    bgFarOpacity: 0.6,
    bgNearOpacity: 0.9,
    bgWindow: 'rgba(120,255,230,0.6)',
    ground: '#0a0518',
    groundBorder: '#7c2fff',
    street: '#ff2fb0',
    blocks: [
      ['#2fffd6', '#0fbfa0'],
      ['#ff2fb0', '#d2148a'],
      ['#9bff3a', '#6fcf1f'],
      ['#ffe53a', '#e0c01f'],
    ],
    windowLit: 'rgba(180,255,245,0.95)',
    windowDark: 'rgba(20,10,40,0.6)',
  },
];

export const getTheme = (key: string): Theme =>
  THEMES.find((t) => t.key === key) ?? THEMES[0];
