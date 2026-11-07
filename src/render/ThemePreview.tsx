import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { nextRandom } from '@/engine';
import type { SkyTheme } from './themes';

// Ayarlar ve rekorlar için küçük sahne: tema gökyüzü + silüet + üç kat kule.
// Oyundaki çizimle aynı dil, sadece ölçekli ve sabit.

type Props = { theme: SkyTheme; width: number; height: number; floors?: number; towerAt?: number };

function skyline(width: number, base: number, seed: number, minH: number, maxH: number) {
  const rng = { rng: seed };
  const r = () => nextRandom(rng);
  const p = Skia.PathBuilder.Make();
  let x = -4;
  while (x < width + 4) {
    const w = 8 + r() * 16;
    const h = minH + r() * (maxH - minH);
    p.addRect(Skia.XYWHRect(x, base - h, w + 0.5, h + 2));
    x += w + (r() < 0.25 ? 2 : 0);
  }
  return p.build();
}

function Floor({
  x,
  y,
  s,
  theme,
  style,
  lit,
}: {
  x: number;
  y: number;
  s: number;
  theme: SkyTheme;
  style: number;
  lit: number;
}) {
  const pal = theme.blocks[style % theme.blocks.length];
  const d = s * 0.13;
  const t = s * 0.08;
  const side = useMemo(
    () =>
      Skia.PathBuilder.Make()
        .moveTo(x + s, y)
        .lineTo(x + s + d, y - t)
        .lineTo(x + s + d, y + s - t)
        .lineTo(x + s, y + s)
        .close()
        .build(),
    [x, y, s, d, t]
  );
  const top = useMemo(
    () =>
      Skia.PathBuilder.Make()
        .moveTo(x, y)
        .lineTo(x + d, y - t)
        .lineTo(x + s + d, y - t)
        .lineTo(x + s, y)
        .close()
        .build(),
    [x, y, s, d, t]
  );
  const ww = s * 0.2;
  const wh = s * 0.27;
  return (
    <Group>
      <Path path={side} color={pal.side} />
      <Path path={top} color={pal.slab} />
      <Rect x={x} y={y} width={s} height={s}>
        <LinearGradient start={vec(0, y)} end={vec(0, y + s)} colors={[pal.face, pal.faceLow]} />
      </Rect>
      <Rect x={x} y={y} width={s} height={s * 0.08} color={pal.slab} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const on = (lit >> i) & 1;
        return (
          <RoundedRect
            key={i}
            x={x + s * 0.11 + col * (ww + s * 0.07)}
            y={y + s * 0.18 + row * (wh + s * 0.09)}
            width={ww}
            height={wh}
            r={s * 0.025}
            color={on ? theme.lit[1] : theme.glass[1]}
          />
        );
      })}
    </Group>
  );
}

export const ThemePreview = memo(function ThemePreview({ theme, width, height, floors = 3, towerAt = 0.5 }: Props) {
  const ground = height * 0.88;
  const far = useMemo(() => skyline(width, ground, 21, height * 0.18, height * 0.45), [width, height, ground]);
  const near = useMemo(() => skyline(width, ground, 7, height * 0.08, height * 0.26), [width, height, ground]);
  const s = Math.min(Math.min(width, height) * 0.26, (ground - height * 0.12) / (floors + 0.4));
  const tx = width * towerAt - s / 2 - s * 0.06;
  const lits = [0b101101, 0b011110, 0b110011, 0b100111, 0b011011];

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, ground)} colors={theme.skyLow} />
      </Rect>
      {theme.sun && (
        <Circle cx={width * 0.74} cy={ground - height * 0.3} r={width * 0.45}>
          <RadialGradient
            c={vec(width * 0.74, ground - height * 0.3)}
            r={width * 0.45}
            colors={[theme.sun + '88', theme.sun + '00']}
          />
        </Circle>
      )}
      {theme.sun && <Circle cx={width * 0.74} cy={ground - height * 0.3} r={width * 0.07} color={theme.sun} />}
      <Path path={far} color={theme.far} opacity={0.7} />
      <Path path={near} color={theme.near} />
      <Rect x={0} y={ground} width={width} height={height - ground} color={theme.ground} />
      <Rect x={0} y={ground} width={width} height={1.5} color={theme.groundEdge} opacity={0.8} />
      {Array.from({ length: floors }).map((_, i) => (
        <Floor key={i} x={tx} y={ground - (i + 1) * s} s={s} theme={theme} style={i} lit={lits[i % lits.length]} />
      ))}
    </Canvas>
  );
});
