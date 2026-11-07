import { Skia, type SkCanvas, type SkTypeface } from '@shopify/react-native-skia';
import { BLOCK, nextRandom, type Block } from '@/engine';
import { alpha, mix, smooth } from './color';
import { R, linear, paint, radial } from './draw';
import { drawFloor } from './floors';
import type { SkyTheme } from './themes';

// Paylaşılabilir kule kartı: 1080x1920 (hikâye boyutu). Oyuncunun kulesi kendi
// kat stiliyle, kaç kat ve puan, altta kısa bir davet.

const W = 1080;
const H = 1920;
const GROUND = 1660;

export type CardInput = {
  theme: SkyTheme;
  skin: string;
  blocks: Block[];
  floors: number;
  score: string;
  unit: string; // "KAT"
  scoreLabel: string; // "puan"
  subtitle: string; // "Normal · 7 Kas 2026"
  footer: string;
  footer2: string;
  bold: SkTypeface;
  semi: SkTypeface;
};

function skyline(c: SkCanvas, seed: number, minH: number, maxH: number, color: string, windows: string | null) {
  const rng = { rng: seed };
  const r = () => nextRandom(rng);
  const body = paint(color);
  const win = windows ? paint(windows) : null;
  let x = -10;
  while (x < W + 10) {
    const w = 50 + r() * 90;
    const h = minH + r() * (maxH - minH);
    c.drawRect(R(x, GROUND - h, w + 1, h + 4), body);
    if (win) {
      for (let wy = GROUND - h + 18; wy < GROUND - 16; wy += 22) {
        for (let wx = x + 10; wx < x + w - 12; wx += 16) {
          if (r() < 0.18) {
            win.setAlphaf(0.35 + r() * 0.5);
            c.drawRect(R(wx, wy, 6, 9), win);
          }
        }
      }
    }
    x += w + (r() < 0.3 ? 6 + r() * 20 : 0);
  }
}

function text(
  c: SkCanvas,
  s: string,
  x: number,
  y: number,
  size: number,
  tf: SkTypeface,
  color: string,
  align: 'left' | 'center' = 'left'
) {
  const font = Skia.Font(tf, size);
  const p = paint(color);
  const w = align === 'center' ? font.measureText(s).width : 0;
  c.drawText(s, align === 'center' ? x - w / 2 : x, y, p, font);
  return font.measureText(s).width;
}

export function renderShareCard(i: CardInput): Uint8Array | null {
  const surface = Skia.Surface.MakeOffscreen(W, H) ?? Skia.Surface.Make(W, H);
  if (!surface) return null;
  const c = surface.getCanvas();
  const t = i.theme;
  const alt = smooth(0, 45, i.floors);

  // gökyüzü kulenin yüksekliğine göre
  const sky = paint();
  sky.setShader(linear(0, 0, 0, GROUND, [mix(t.skyLow[0], t.skyHigh[0], alt), mix(t.skyLow[1], t.skyHigh[1], alt)]));
  c.drawRect(R(0, 0, W, H), sky);

  if (t.stars && alt > 0.2) {
    const st = { rng: 5 };
    const p = paint('#FFFFFF');
    for (let k = 0; k < 120; k++) {
      p.setAlphaf((0.3 + nextRandom(st) * 0.6) * Math.min(1, alt * 1.4));
      c.drawCircle(nextRandom(st) * W, nextRandom(st) * GROUND * 0.7, 1 + nextRandom(st) * 2.2, p);
    }
  }
  if (t.sun) {
    const sy = GROUND - 420 + alt * 300;
    const g = paint();
    g.setShader(radial(780, sy, 520, [alpha(t.sun, 0.5), alpha(t.sun, 0)]));
    c.drawCircle(780, sy, 520, g);
    c.drawCircle(780, sy, 80, paint(t.sun));
  }

  skyline(c, 21, 260, 760, alpha(t.far, 0.7), null);
  skyline(c, 7, 160, 520, t.mid, t.nearWindow);
  skyline(c, 3, 80, 300, t.near, t.nearWindow);
  const ground = paint();
  ground.setShader(linear(0, GROUND, 0, H, [t.ground, mix(t.ground, '#000000', 0.5)]));
  c.drawRect(R(0, GROUND, W, H - GROUND), ground);
  c.drawRect(R(0, GROUND, W, 5), paint(t.groundEdge, 0.85));

  // kule: kartın orta bölümüne sığdırılır
  const n = i.blocks.length;
  if (n) {
    const room = GROUND - 700;
    const s = Math.min(170, room / n);
    const k = s / BLOCK;
    const b0 = i.blocks[0].cx;
    const sh = paint();
    sh.setShader(radial(W / 2, GROUND + 6, s * 1.3, ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']));
    c.save();
    c.scale(1, 0.2);
    c.drawCircle(W / 2, (GROUND + 6) / 0.2, s * 1.3, sh);
    c.restore();
    for (let l = 0; l < n; l++) {
      const b = i.blocks[l];
      c.save();
      c.translate(W / 2 + (b.cx - b0) * k - s / 2, GROUND - (l + 1) * s);
      c.scale(k, k);
      drawFloor(c, t, i.skin, b.style, b.lit, l === 0);
      c.restore();
    }
  }

  // okunabilirlik için üst ve alt perdeler
  const top = paint();
  top.setShader(linear(0, 0, 0, 760, ['rgba(8,10,20,0.78)', 'rgba(8,10,20,0)']));
  c.drawRect(R(0, 0, W, 760), top);
  const bottom = paint();
  bottom.setShader(linear(0, H - 340, 0, H, ['rgba(8,10,20,0)', 'rgba(8,10,20,0.85)']));
  c.drawRect(R(0, H - 340, W, 340), bottom);

  // yazılar
  const wm = text(c, 'Plumbline', 84, 170, 72, i.bold, '#FFFFFF');
  c.drawRect(R(84 + wm + 6, 154, 16, 16), paint(t.accent));
  text(c, i.subtitle.toUpperCase(), 86, 236, 32, i.semi, alpha('#FFFFFF', 0.7));

  const num = String(i.floors);
  const nw = text(c, num, 76, 520, 280, i.bold, '#FFFFFF');
  text(c, i.unit.toUpperCase(), 76 + nw + 24, 520, 64, i.bold, t.accent);
  text(c, `${i.score} ${i.scoreLabel}`, 86, 608, 52, i.semi, alpha('#FFFFFF', 0.85));

  text(c, i.footer, W / 2, H - 150, 46, i.bold, '#FFFFFF', 'center');
  text(c, i.footer2, W / 2, H - 90, 32, i.semi, alpha('#FFFFFF', 0.6), 'center');

  surface.flush();
  const img = surface.makeImageSnapshot();
  return img.encodeToBytes();
}
