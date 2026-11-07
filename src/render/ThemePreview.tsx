import { Canvas, PaintStyle, Picture, Skia, type SkCanvas } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { BLOCK, nextRandom } from '@/engine';
import { alpha } from './color';
import { R, linear, paint, radial, record } from './draw';
import { drawFloor } from './floors';
import type { SkyTheme } from './themes';

// Ayarlar, mağaza ve rekorlar için küçük sahne: tema gökyüzü + silüet + kule.
// Katlar oyundakiyle aynı fonksiyonla çizilir, kat stili de yansır.

type Props = {
  theme: SkyTheme;
  width: number;
  height: number;
  floors?: number;
  towerAt?: number;
  skin?: string;
  crane?: string | null; // vinç rengi verilirse tepede kiriş ve kanca çizilir
};

function skyline(c: SkCanvas, width: number, base: number, seed: number, minH: number, maxH: number, color: string) {
  const rng = { rng: seed };
  const r = () => nextRandom(rng);
  const p = paint(color);
  let x = -4;
  while (x < width + 4) {
    const w = 8 + r() * 16;
    const h = minH + r() * (maxH - minH);
    c.drawRect(R(x, base - h, w + 0.5, h + 2), p);
    x += w + (r() < 0.25 ? 2 : 0);
  }
}

export function drawPreview(
  c: SkCanvas,
  { theme, width, height, floors = 3, towerAt = 0.5, skin = 'classic', crane = null }: Props
) {
  const ground = height * 0.88;
  const sky = paint();
  sky.setShader(linear(0, 0, 0, ground, theme.skyLow));
  c.drawRect(R(0, 0, width, height), sky);
  if (theme.sun) {
    const sx = width * 0.74;
    const sy = ground - height * 0.3;
    const glow = paint();
    glow.setShader(radial(sx, sy, width * 0.45, [alpha(theme.sun, 0.55), alpha(theme.sun, 0)]));
    c.drawCircle(sx, sy, width * 0.45, glow);
    c.drawCircle(sx, sy, Math.min(width, height) * 0.07, paint(theme.sun));
  }
  skyline(c, width, ground, 21, height * 0.18, height * 0.45, alpha(theme.far, 0.7));
  skyline(c, width, ground, 7, height * 0.08, height * 0.26, theme.near);
  c.drawRect(R(0, ground, width, height - ground), paint(theme.ground));
  c.drawRect(R(0, ground, width, 1.5), paint(theme.groundEdge, 0.8));

  const s = Math.min(Math.min(width, height) * 0.26, (ground - height * 0.12) / (floors + 0.4));
  const k = s / BLOCK;
  const tx = width * towerAt - s / 2 - s * 0.06;
  const lits = [0b101101, 0b011110, 0b110011, 0b100111, 0b011011];
  for (let i = 0; i < floors; i++) {
    c.save();
    c.translate(tx, ground - (i + 1) * s);
    c.scale(k, k);
    drawFloor(c, theme, skin, i, lits[i % lits.length], i === 0 && floors > 2);
    c.restore();
  }

  if (crane) {
    // üstte kiriş ve kanca: vinç rengini göstermek için
    const cx = width * towerAt;
    const top = ground - floors * s - s * 0.9;
    const st = paint(crane);
    st.setStyle(PaintStyle.Stroke);
    st.setStrokeWidth(Math.max(1, s * 0.05));
    const y0 = s * 0.35;
    const y1 = s * 0.6;
    c.drawLine(0, y0, width, y0, st);
    c.drawLine(0, y1, width, y1, st);
    for (let x = 0; x < width; x += s * 0.5) {
      c.drawLine(x, y1, x + s * 0.25, y0, st);
      c.drawLine(x + s * 0.25, y0, x + s * 0.5, y1, st);
    }
    const cable = paint(theme.cable);
    cable.setStyle(PaintStyle.Stroke);
    cable.setStrokeWidth(1.2);
    c.drawLine(cx, y1, cx, top, cable);
    c.drawRRect(Skia.RRectXY(R(cx - s * 0.12, top - s * 0.1, s * 0.24, s * 0.18), 3, 3), paint(crane));
  }
}

export const ThemePreview = memo(function ThemePreview(props: Props) {
  const { width, height, theme, floors, towerAt, skin, crane } = props;
  const pic = useMemo(
    () => record(width, height, (c) => drawPreview(c, { theme, width, height, floors, towerAt, skin, crane })),
    [theme, width, height, floors, towerAt, skin, crane]
  );
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Picture picture={pic} />
    </Canvas>
  );
});
