import { PaintStyle, Skia, type SkCanvas } from '@shopify/react-native-skia';
import { BLOCK } from '@/engine';
import { R, linear, paint, poly } from './draw';
import type { BlockPalette, SkyTheme } from './themes';

// Kat stilleri. Her kat 64x64 ön yüz + sağda yan yüz + üstte döşeme yüzü olarak,
// (0,0) sol üst köşeye çizilir. Sahne, önizlemeler ve paylaşım kartı aynı kodu kullanır.

export const DEPTH = 8;
export const TOP = 5;
const B = BLOCK;

type Pal = BlockPalette;

// stil başına dört renk varyasyonu (kat sırasıyla döner)
const PALETTES: Record<string, Pal[]> = {
  glass: [
    { face: '#7CC4DE', faceLow: '#3F86AE', side: '#2B5F80', slab: '#D9F1FA' },
    { face: '#8FA8E6', faceLow: '#4E68B8', side: '#36488A', slab: '#E1E8FB' },
    { face: '#7FD3C0', faceLow: '#3C9C88', side: '#2A7062', slab: '#D7F4EC' },
    { face: '#B9C7D9', faceLow: '#7489A6', side: '#55667F', slab: '#EEF2F8' },
  ],
  brick: [
    { face: '#B9573F', faceLow: '#94422F', side: '#6E3022', slab: '#DDD6CB' },
    { face: '#9C5A3C', faceLow: '#7B452D', side: '#5A3220', slab: '#DDD6CB' },
    { face: '#C27A4A', faceLow: '#9E6038', side: '#744528', slab: '#E3DCD0' },
    { face: '#8E3F36', faceLow: '#6F2F28', side: '#51221D', slab: '#DDD6CB' },
  ],
  timber: [
    { face: '#C99363', faceLow: '#A8774C', side: '#7E5735', slab: '#F0E3CF' },
    { face: '#B5835A', faceLow: '#946742', side: '#6C4A2E', slab: '#EADCC6' },
    { face: '#D8A877', faceLow: '#B58858', side: '#87623E', slab: '#F4E8D6' },
    { face: '#A77452', faceLow: '#875A3C', side: '#62402A', slab: '#E6D6BF' },
  ],
  neon: [
    { face: '#1B1430', faceLow: '#120D22', side: '#0A0715', slab: '#FF3CAC' },
    { face: '#121C33', faceLow: '#0C1324', side: '#060B16', slab: '#00F0FF' },
    { face: '#1D1230', faceLow: '#140C22', side: '#0B0616', slab: '#B26BFF' },
    { face: '#10241E', faceLow: '#0B1914', side: '#06100C', slab: '#3DFFB0' },
  ],
  copper: [
    { face: '#C27C45', faceLow: '#9B5D30', side: '#6F4120', slab: '#E9C9A5' },
    { face: '#5E9C8F', faceLow: '#467B70', side: '#30584F', slab: '#CDE6DF' },
    { face: '#B5703C', faceLow: '#8E532A', side: '#653A1C', slab: '#E9C9A5' },
    { face: '#6FA99A', faceLow: '#52867A', side: '#386157', slab: '#D4EBE4' },
  ],
  gold: [
    { face: '#F0CF7A', faceLow: '#CDA247', side: '#9B7429', slab: '#FFF4CF' },
    { face: '#E7C063', faceLow: '#C39538', side: '#916A22', slab: '#FFF0C2' },
    { face: '#F5D98F', faceLow: '#D3AC57', side: '#A27C33', slab: '#FFF7DC' },
    { face: '#DDB257', faceLow: '#B9882F', side: '#87601D', slab: '#FFEDB8' },
  ],
};

export function paletteFor(theme: SkyTheme, skin: string, style: number): Pal {
  const list = PALETTES[skin] ?? theme.blocks;
  return list[style % list.length];
}

function body(c: SkCanvas, pal: Pal) {
  c.drawPath(poly([B, 0], [B + DEPTH, -TOP], [B + DEPTH, B - TOP], [B, B]), paint(pal.side));
  c.drawPath(poly([0, 0], [DEPTH, -TOP], [B + DEPTH, -TOP], [B, 0]), paint(pal.slab));
  const face = paint();
  face.setShader(linear(0, 0, 0, B, [pal.face, pal.faceLow]));
  c.drawRect(R(0, 0, B, B), face);
}

// 3x2 pencere ızgarası; her pencere için çizim fonksiyonu çağrılır
function grid(
  draw: (x: number, y: number, w: number, h: number, i: number) => void,
  inset = 7,
  top = 11,
  gx = 4,
  gy = 5
) {
  const cols = 3;
  const rows = 2;
  const ww = (B - inset * 2 - gx * (cols - 1)) / cols;
  const wh = (B - top - 5 - gy * (rows - 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) draw(inset + k * (ww + gx), top + r * (wh + gy), ww, wh, r * cols + k);
  }
}

function lobby(c: SkCanvas, theme: SkyTheme, pal: Pal) {
  const glass = paint();
  glass.setShader(linear(0, 10, 0, B, theme.glass));
  const lit = paint();
  lit.setShader(linear(0, 10, 0, B, theme.lit));
  const mull = paint(pal.side, 0.55);
  c.drawRRect(Skia.RRectXY(R(6, 16, B - 12, B - 18), 2, 2), glass);
  c.drawRect(R(B / 2 - 7, B - 26, 14, 24), lit);
  c.drawRect(R(-3, 12, B + 6, 4), paint(pal.slab));
  for (let i = 1; i < 4; i++) c.drawRect(R(6 + ((B - 12) / 4) * i, 16, 1, B - 18), mull);
}

export function drawFloor(c: SkCanvas, theme: SkyTheme, skin: string, style: number, lit: number, base: boolean) {
  const pal = paletteFor(theme, skin, style);
  body(c, pal);

  const glass = paint();
  glass.setShader(linear(0, 10, 0, B, theme.glass));
  const litP = paint();
  litP.setShader(linear(0, 10, 0, B, theme.lit));
  const on = (i: number) => (lit >> i) & 1;

  if (base) {
    c.drawRect(R(0, 0, B, 5), paint(pal.slab));
    lobby(c, theme, pal);
    return;
  }

  switch (skin) {
    case 'glass': {
      // giydirme cephe: tek parça cam, ince kayıtlar, çapraz parlama
      const sheen = paint('#FFFFFF', 0.16);
      c.drawPath(poly([0, 0], [B * 0.55, 0], [0, B * 0.7]), sheen);
      grid(
        (x, y, w, h, i) => {
          if (on(i)) c.drawRect(R(x, y, w, h), paint(theme.lit[1], 0.55));
        },
        4,
        6,
        2,
        2
      );
      const m = paint('#FFFFFF', 0.45);
      for (let k = 1; k < 3; k++) c.drawRect(R((B / 3) * k - 0.6, 0, 1.2, B), m);
      c.drawRect(R(0, B / 2 - 0.6, B, 1.2), m);
      c.drawRect(R(0, 0, B, 3), paint(pal.slab));
      break;
    }
    case 'brick': {
      // tuğla örgüsü + krem çerçeveli pencereler
      const joint = paint(pal.side, 0.35);
      for (let y = 6; y < B; y += 6) {
        c.drawRect(R(0, y, B, 0.8), joint);
        const off = (y / 6) % 2 ? 0 : 6;
        for (let x = off; x < B; x += 12) c.drawRect(R(x, y - 6, 0.8, 6), joint);
      }
      grid(
        (x, y, w, h, i) => {
          c.drawRect(R(x - 1.5, y - 1.5, w + 3, h + 3), paint('#EFE6D6'));
          c.drawRect(R(x, y, w, h), on(i) ? litP : glass);
          c.drawRect(R(x - 2, y + h + 1, w + 4, 2), paint('#D9CDB8'));
        },
        8,
        12,
        5,
        7
      );
      c.drawRect(R(0, 0, B, 5), paint(pal.slab));
      break;
    }
    case 'timber': {
      // dikey ahşap çıtalar + geniş pencereler
      const slat = paint(pal.faceLow, 0.35);
      for (let x = 5; x < B; x += 7) c.drawRect(R(x, 0, 1.2, B), slat);
      const frame = paint('#3A2A1E');
      for (let r = 0; r < 2; r++) {
        for (let k = 0; k < 2; k++) {
          const x = 7 + k * 27;
          const y = 11 + r * 25;
          c.drawRect(R(x - 1.5, y - 1.5, 26, 21), frame);
          c.drawRect(R(x, y, 23, 18), on(r * 2 + k) ? litP : glass);
          c.drawRect(R(x + 11, y, 1, 18), frame);
        }
      }
      c.drawRect(R(0, 0, B, 5), paint(pal.slab));
      break;
    }
    case 'neon': {
      // karanlık gövde, neon kenarlar ve pencere çizgileri
      const neon = paint(pal.slab);
      neon.setStyle(PaintStyle.Stroke);
      neon.setStrokeWidth(1.6);
      c.drawRect(R(0.8, 0.8, B - 1.6, B - 1.6), neon);
      grid((x, y, w, h, i) => {
        if (on(i)) c.drawRRect(Skia.RRectXY(R(x, y, w, h), 2, 2), paint(pal.slab, 0.45));
        c.drawRRect(Skia.RRectXY(R(x, y, w, h), 2, 2), neon);
      });
      c.drawRect(R(0, 0, B, 3), paint(pal.slab));
      break;
    }
    case 'copper':
    case 'gold': {
      // metal paneller: koyu cam, ince parlak kayıtlar
      const trim = paint(pal.slab, skin === 'gold' ? 0.9 : 0.7);
      grid((x, y, w, h, i) => {
        c.drawRect(R(x, y, w, h), on(i) ? litP : paint('#1C2236'));
        c.drawRect(R(x - 1, y - 1, w + 2, 1), trim);
        c.drawRect(R(x - 1, y + h, w + 2, 1), trim);
      });
      for (let k = 1; k < 3; k++) c.drawRect(R((B / 3) * k - 0.5, 4, 1, B - 4), paint(pal.side, 0.5));
      c.drawRect(R(0, 0, B, 5), paint(pal.slab));
      break;
    }
    default: {
      // klasik: temanın renkleri, camlarda parlama
      const sheen = paint('#FFFFFF', 0.14);
      const mull = paint(pal.side, 0.55);
      c.drawRect(R(0, 0, B, 5), paint(pal.slab));
      grid((x, y, w, h, i) => {
        c.drawRRect(Skia.RRectXY(R(x, y, w, h), 1.5, 1.5), on(i) ? litP : glass);
        if (!on(i)) c.drawPath(poly([x, y], [x + w * 0.7, y], [x, y + h * 0.55]), sheen);
        c.drawRect(R(x + w / 2 - 0.5, y, 1, h), mull);
      });
    }
  }

  c.drawRect(R(0, B - 2, B, 2), paint(pal.side));
  c.drawRect(R(0, 0, 1.5, B), paint('#FFFFFF', 0.2));
}
