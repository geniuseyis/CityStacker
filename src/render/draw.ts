import {
  Skia,
  TileMode,
  vec,
  type SkCanvas,
  type SkPaint,
  type SkPicture,
  type SkShader,
} from '@shopify/react-native-skia';

// sahne, önizleme ve paylaşım kartının ortak küçük çizim yardımcıları

export const C = (c: string) => Skia.Color(c);
export const R = (x: number, y: number, w: number, h: number) => Skia.XYWHRect(x, y, w, h);

export function paint(color?: string, a?: number): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  if (color) p.setColor(C(color));
  if (a !== undefined) p.setAlphaf(a);
  return p;
}

export function linear(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  colors: string[],
  pos: number[] | null = null
): SkShader {
  return Skia.Shader.MakeLinearGradient(vec(x0, y0), vec(x1, y1), colors.map(C), pos, TileMode.Clamp);
}

export function radial(x: number, y: number, r: number, colors: string[]): SkShader {
  return Skia.Shader.MakeRadialGradient(vec(x, y), r, colors.map(C), null, TileMode.Clamp);
}

export function poly(...pts: [number, number][]) {
  const b = Skia.PathBuilder.Make().moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) b.lineTo(pts[i][0], pts[i][1]);
  return b.close().build();
}

export function record(w: number, h: number, draw: (c: SkCanvas) => void, x = 0, y = 0): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(R(x, y, w, h));
  draw(c);
  return rec.finishRecordingAsPicture();
}
