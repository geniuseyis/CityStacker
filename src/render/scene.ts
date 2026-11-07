import {
  PaintStyle,
  Skia,
  TileMode,
  vec,
  type SkCanvas,
  type SkPaint,
  type SkPicture,
  type SkShader,
} from '@shopify/react-native-skia';
import {
  BLOCK,
  GROUND_Y,
  PIVOT_Y,
  VIEW_H,
  VIEW_W,
  levelTop,
  nextRandom,
  ropeEnd,
  type GameEvent,
  type GameState,
} from '@/engine';
import { alpha, mix, smooth } from './color';
import type { SkyTheme } from './themes';

const C = (c: string) => Skia.Color(c);
const R = (x: number, y: number, w: number, h: number) => Skia.XYWHRect(x, y, w, h);

const DEPTH = 8; // blokların sağ yan yüz derinliği
const TOP = 5;
const SPAN = 260; // arka plan katmanlarının ekran dışına taşma payı

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  round: boolean;
};

type Ring = { x: number; y: number; t: number; color: string };

function paint(color?: string): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  if (color) p.setColor(C(color));
  return p;
}

function linear(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  colors: string[],
  pos: number[] | null = null
): SkShader {
  return Skia.Shader.MakeLinearGradient(vec(x0, y0), vec(x1, y1), colors.map(C), pos, TileMode.Clamp);
}

function record(w: number, h: number, draw: (c: SkCanvas) => void, x = 0, y = 0): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(R(x, y, w, h));
  draw(c);
  return rec.finishRecordingAsPicture();
}

export class Scene {
  theme: SkyTheme;
  reducedMotion = false;

  private blockPics = new Map<string, SkPicture>();
  private layers: { pic: SkPicture; depth: number }[] = [];
  private clouds: SkPicture;
  private stars: { x: number; y: number; r: number; tw: number }[] = [];
  private skyCache = new Map<number, SkShader>();
  private sunPic: SkPicture | null = null;

  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private flash = 0;
  private shake = 0;
  private time = 0;
  private hook = { x: VIEW_W / 2, y: PIVOT_Y + 40 };

  private p = paint();
  private stroke = paint();
  private fxRng = { rng: 0x5eed };

  constructor(theme: SkyTheme) {
    this.theme = theme;
    this.stroke.setStyle(PaintStyle.Stroke);
    this.buildBackground();
    this.clouds = this.buildClouds();
  }

  setTheme(theme: SkyTheme) {
    if (theme.key === this.theme.key) return;
    this.theme = theme;
    this.blockPics.clear();
    this.skyCache.clear();
    this.buildBackground();
    this.clouds = this.buildClouds();
  }

  private rand() {
    return nextRandom(this.fxRng);
  }

  /* ---------------------------- önbellek ---------------------------- */

  private buildBackground() {
    const t = this.theme;
    // sabit seed: her açılışta aynı silüet
    const rng = { rng: 2024 };
    const r = () => nextRandom(rng);

    const layer = (
      fill: string,
      minH: number,
      maxH: number,
      minW: number,
      maxW: number,
      windows: boolean,
      haze: number
    ) =>
      record(
        VIEW_W + SPAN * 2,
        VIEW_H,
        (c) => {
          const base = GROUND_Y + 2;
          const body = paint(fill);
          const win = paint(t.nearWindow);
          let x = -SPAN;
          while (x < VIEW_W + SPAN) {
            const w = minW + r() * (maxW - minW);
            const h = minH + r() * (maxH - minH);
            const top = base - h;
            c.drawRect(R(x, top, w + 1, h + 40), body);
            // bazılarında kademe ya da anten
            const k = r();
            if (k < 0.25) c.drawRect(R(x + w * 0.25, top - h * 0.12, w * 0.5, h * 0.12 + 1), body);
            else if (k < 0.4) c.drawRect(R(x + w * 0.5 - 1, top - 18, 2, 18), body);
            if (windows) {
              for (let wy = top + 8; wy < base - 8; wy += 9) {
                for (let wx = x + 5; wx < x + w - 6; wx += 7) {
                  if (r() < 0.16) {
                    win.setAlphaf(0.35 + r() * 0.5);
                    c.drawRect(R(wx, wy, 3, 4), win);
                  }
                }
              }
            }
            x += w + (r() < 0.3 ? 2 + r() * 10 : 0);
          }
          if (haze > 0) {
            const hz = paint();
            hz.setShader(linear(0, base - 220, 0, base, [alpha(t.skyLow[1], 0), alpha(t.skyLow[1], haze)]));
            c.drawRect(R(-SPAN, base - 220, VIEW_W + SPAN * 2, 222), hz);
          }
        },
        -SPAN,
        0
      );

    this.layers = [
      { pic: layer(t.far, 120, 330, 26, 60, false, 0.45), depth: 0.18 },
      { pic: layer(t.mid, 70, 220, 30, 70, true, 0.3), depth: 0.38 },
      { pic: layer(t.near, 30, 120, 40, 90, true, 0), depth: 0.7 },
    ];

    this.stars = [];
    const sr = { rng: 77 };
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: nextRandom(sr) * (VIEW_W + 200) - 100,
        y: nextRandom(sr) * (VIEW_H + 200) - 200,
        r: 0.5 + nextRandom(sr) * 1.3,
        tw: nextRandom(sr) * Math.PI * 2,
      });
    }

    this.sunPic = t.sun
      ? record(400, 400, (c) => {
          const glow = paint();
          glow.setShader(
            Skia.Shader.MakeRadialGradient(
              vec(200, 200),
              190,
              [C(alpha(t.sun!, 0.55)), C(alpha(t.sun!, 0))],
              null,
              TileMode.Clamp
            )
          );
          c.drawCircle(200, 200, 190, glow);
          c.drawCircle(200, 200, 34, paint(t.sun!));
        })
      : null;
  }

  private buildClouds(): SkPicture {
    const rng = { rng: 99 };
    const r = () => nextRandom(rng);
    const tint = this.theme.key === 'neon' ? '#B26BFF' : '#FFFFFF';
    // dünya yüksekliği (yerden yukarı) — bulut kuşakları
    return record(
      VIEW_W + SPAN * 2,
      4000,
      (c) => {
        const p = paint();
        for (let i = 0; i < 14; i++) {
          const cx = -120 + r() * (VIEW_W + 240);
          const cy = 3800 - (500 + i * 230 + r() * 120);
          const n = 3 + Math.floor(r() * 3);
          for (let k = 0; k < n; k++) {
            const px = cx + (k - n / 2) * (26 + r() * 14);
            const py = cy + (r() - 0.5) * 14;
            const rad = 28 + r() * 26;
            p.setShader(
              Skia.Shader.MakeRadialGradient(
                vec(px, py),
                rad,
                [C(alpha(tint, 0.16)), C(alpha(tint, 0))],
                null,
                TileMode.Clamp
              )
            );
            c.drawCircle(px, py, rad, p);
          }
        }
      },
      -SPAN,
      0
    );
  }

  private blockPic(style: number, lit: number, base: boolean): SkPicture {
    const key = `${style}:${lit}:${base ? 1 : 0}`;
    let pic = this.blockPics.get(key);
    if (pic) return pic;
    const t = this.theme;
    const pal = t.blocks[style % t.blocks.length];
    const B = BLOCK;

    pic = record(
      B + DEPTH + 4,
      B + TOP + 4,
      (c) => {
        // sağ yan yüz
        const side = Skia.PathBuilder.Make()
          .moveTo(B, 0)
          .lineTo(B + DEPTH, -TOP)
          .lineTo(B + DEPTH, B - TOP)
          .lineTo(B, B)
          .close()
          .build();
        c.drawPath(side, paint(pal.side));
        // üst yüz (bir üstteki blok bunu örter, sadece tepe görünür)
        const top = Skia.PathBuilder.Make()
          .moveTo(0, 0)
          .lineTo(DEPTH, -TOP)
          .lineTo(B + DEPTH, -TOP)
          .lineTo(B, 0)
          .close()
          .build();
        c.drawPath(top, paint(pal.slab));

        const face = paint();
        face.setShader(linear(0, 0, 0, B, [pal.face, pal.faceLow]));
        c.drawRect(R(0, 0, B, B), face);

        const slab = paint(pal.slab);
        c.drawRect(R(0, 0, B, 5), slab);
        c.drawRect(R(0, B - 2, B, 2), paint(pal.side));
        const hl = paint('#FFFFFF');
        hl.setAlphaf(0.2);
        c.drawRect(R(0, 0, 1.5, B), hl);

        const glass = paint();
        glass.setShader(linear(0, 10, 0, B, t.glass));
        const litP = paint();
        litP.setShader(linear(0, 10, 0, B, t.lit));
        const sheen = paint('#FFFFFF');
        sheen.setAlphaf(0.14);
        const mull = paint(pal.side);
        mull.setAlphaf(0.55);

        if (base) {
          // lobi: tek parça cam, ortada kapı, saçak
          c.drawRRect(Skia.RRectXY(R(6, 16, B - 12, B - 18), 2, 2), glass);
          c.drawRect(R(B / 2 - 7, B - 26, 14, 24), litP);
          c.drawRect(R(-3, 12, B + 6, 4), slab);
          for (let i = 1; i < 4; i++) c.drawRect(R(6 + ((B - 12) / 4) * i, 16, 1, B - 18), mull);
          return;
        }

        const cols = 3;
        const rows = 2;
        const gx = 4;
        const gy = 5;
        const ww = (B - 14 - gx * (cols - 1)) / cols;
        const wh = (B - 16 - gy * (rows - 1)) / rows;
        for (let rr = 0; rr < rows; rr++) {
          for (let cc = 0; cc < cols; cc++) {
            const i = rr * cols + cc;
            const x = 7 + cc * (ww + gx);
            const y = 11 + rr * (wh + gy);
            const on = (lit >> i) & 1;
            c.drawRRect(Skia.RRectXY(R(x, y, ww, wh), 1.5, 1.5), on ? litP : glass);
            if (!on) {
              const tri = Skia.PathBuilder.Make()
                .moveTo(x, y)
                .lineTo(x + ww * 0.7, y)
                .lineTo(x, y + wh * 0.55)
                .close()
                .build();
              c.drawPath(tri, sheen);
            }
            c.drawRect(R(x + ww / 2 - 0.5, y, 1, wh), mull);
          }
        }
      },
      -2,
      -TOP - 2
    );

    this.blockPics.set(key, pic);
    return pic;
  }

  /* ----------------------------- olaylar ----------------------------- */

  onEvent(ev: GameEvent) {
    const lots = this.reducedMotion ? 0.4 : 1;
    switch (ev.type) {
      case 'land': {
        const y = ev.y + BLOCK;
        if (ev.grade === 'perfect') {
          this.rings.push({ x: ev.x, y: ev.y + BLOCK / 2, t: 0, color: '#FFFFFF' });
          this.confetti(ev.x, ev.y, Math.round(26 * lots));
          if (!this.reducedMotion) this.flash = Math.max(this.flash, 0.5);
        } else {
          this.dust(ev.x, y, Math.round((ev.grade === 'good' ? 8 : 12) * lots), 0.6);
        }
        break;
      }
      case 'miss':
        this.dust(ev.x, ev.y + BLOCK, Math.round(18 * lots), 1);
        break;
      case 'collapse':
        this.dust(ev.x, ev.y + BLOCK, Math.round(40 * lots), 1.4);
        if (!this.reducedMotion) this.shake = 1;
        break;
      default:
        break;
    }
  }

  private confetti(x: number, y: number, n: number) {
    const cols = [...this.theme.blocks.map((b) => b.face), this.theme.accent, '#FFFFFF'];
    for (let i = 0; i < n; i++) {
      const life = 0.9 + this.rand() * 0.6;
      this.particles.push({
        x: x + (this.rand() - 0.5) * BLOCK,
        y,
        vx: (this.rand() - 0.5) * 420,
        vy: -this.rand() * 420 - 140,
        g: 980,
        life,
        max: life,
        size: 4 + this.rand() * 5,
        rot: this.rand() * 360,
        vr: (this.rand() - 0.5) * 900,
        color: cols[(this.rand() * cols.length) | 0],
        round: this.rand() < 0.3,
      });
    }
  }

  private dust(x: number, y: number, n: number, power: number) {
    const base = mix(this.theme.near, '#B9AFA6', 0.55);
    for (let i = 0; i < n; i++) {
      const life = 0.7 + this.rand() * 0.7;
      const dir = this.rand() < 0.5 ? -1 : 1;
      this.particles.push({
        x: x + dir * (BLOCK / 2 - 4) + (this.rand() - 0.5) * 10,
        y: y - this.rand() * 6,
        vx: dir * (60 + this.rand() * 180) * power,
        vy: -this.rand() * 120 * power - 10,
        g: 260,
        life,
        max: life,
        size: 6 + this.rand() * 10 * power,
        rot: 0,
        vr: 0,
        color: mix(base, '#FFFFFF', this.rand() * 0.3),
        round: true,
      });
    }
  }

  reset() {
    this.particles = [];
    this.rings = [];
    this.flash = 0;
    this.shake = 0;
  }

  /* ------------------------------ çizim ------------------------------ */

  private skyShader(alt: number, top: number, bottom: number) {
    const q = Math.round(alt * 100);
    let sh = this.skyCache.get(q);
    if (!sh) {
      const t = this.theme;
      const a = q / 100;
      sh = linear(0, top, 0, bottom, [mix(t.skyLow[0], t.skyHigh[0], a), mix(t.skyLow[1], t.skyHigh[1], a)]);
      this.skyCache.set(q, sh);
    }
    return sh;
  }

  // ekran boyutu (px) verilir, sahne bir SkPicture olarak döner
  render(s: GameState, dt: number, width: number, height: number): SkPicture {
    this.time += dt;
    this.step(dt, s);

    const k = Math.min(width / VIEW_W, height / VIEW_H);
    const ox = (width - VIEW_W * k) / 2;
    const oy = height - VIEW_H * k;
    const t = this.theme;
    const alt = smooth(0, 3200, s.camY);

    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(R(0, 0, width, height));
    const p = this.p;

    // gökyüzü tüm ekranı kaplar
    p.setShader(this.skyShader(alt, oy, oy + GROUND_Y * k));
    c.drawRect(R(0, 0, width, height), p);
    p.setShader(null);

    const shakeX = this.shake > 0 ? (this.rand() - 0.5) * this.shake * 14 : 0;
    const shakeY = this.shake > 0 ? (this.rand() - 0.5) * this.shake * 6 : 0;

    c.save();
    c.translate(ox + shakeX, oy + shakeY);
    c.scale(k, k);

    // yıldızlar: yükseldikçe belirir
    if (t.stars) {
      const vis = smooth(0.25, 0.75, alt) + (t.key === 'night' || t.key === 'neon' ? 0.6 : 0);
      if (vis > 0.01) {
        p.setColor(C('#FFFFFF'));
        for (const st of this.stars) {
          const tw = this.reducedMotion ? 0.8 : 0.6 + 0.4 * Math.sin(this.time * 1.7 + st.tw);
          p.setAlphaf(Math.min(1, vis) * tw * 0.9);
          c.drawCircle(st.x, st.y + ((s.camY * 0.03) % 40), st.r, p);
        }
        p.setAlphaf(1);
      }
    }

    if (this.sunPic) {
      c.save();
      c.translate(VIEW_W * 0.72 - 200, GROUND_Y - 190 - 200 + s.camY * 0.12);
      c.drawPicture(this.sunPic);
      c.restore();
    }

    // bulutlar, dünyaya yakın parallax
    c.save();
    c.translate(s.camX * 0.1, GROUND_Y - 3800 + s.camY * 0.85);
    c.drawPicture(this.clouds);
    c.restore();

    for (const l of this.layers) {
      const dy = s.camY * l.depth;
      if (dy > VIEW_H + 400) continue;
      c.save();
      c.translate(s.camX * l.depth * 0.25, dy);
      c.drawPicture(l.pic);
      c.restore();
    }

    // zemin
    const gy = GROUND_Y + s.camY;
    if (gy < VIEW_H + 40) {
      p.setShader(linear(0, gy, 0, gy + 160, [t.ground, mix(t.ground, '#000000', 0.5)]));
      c.drawRect(R(-SPAN, gy, VIEW_W + SPAN * 2, 400), p);
      p.setShader(null);
      p.setColor(C(t.groundEdge));
      p.setAlphaf(0.8);
      c.drawRect(R(-SPAN, gy, VIEW_W + SPAN * 2, 2), p);
      p.setAlphaf(0.18);
      for (let x = -SPAN + 10; x < VIEW_W + SPAN; x += 46) c.drawRect(R(x, gy + 46, 22, 3), p);
      p.setAlphaf(1);

      // kulenin zemine düşen yumuşak gölgesi
      if (s.blocks.length) {
        const bx = s.blocks[0].cx + s.camX;
        p.setShader(
          Skia.Shader.MakeRadialGradient(
            vec(bx, gy + 3),
            BLOCK,
            [C('rgba(0,0,0,0.45)'), C('rgba(0,0,0,0)')],
            null,
            TileMode.Clamp
          )
        );
        c.save();
        c.scale(1, 0.18);
        c.drawCircle(bx, (gy + 3) / 0.18, BLOCK, p);
        c.restore();
        p.setShader(null);
      }
    }

    // kule
    const n = s.blocks.length;
    for (let i = 0; i < n; i++) {
      const b = s.blocks[i];
      const y = levelTop(b.level) + s.camY;
      if (y > VIEW_H + BLOCK || y < -BLOCK * 2 - 400) continue;
      const x = b.cx - BLOCK / 2 + s.camX;
      c.save();
      c.translate(x, y);
      if (b.rot) c.rotate(b.rot, BLOCK / 2, BLOCK / 2);
      c.drawPicture(this.blockPic(b.style, b.lit, b.level === 0));
      c.restore();
    }

    this.drawCrane(c, s);

    if (s.cur) {
      c.save();
      c.translate(s.cur.x, s.cur.y);
      c.drawPicture(this.blockPic(s.cur.style, s.cur.lit, n === 0 && s.phase !== 'falling'));
      c.restore();
    }

    this.drawFx(c);
    c.restore();

    if (this.flash > 0) {
      p.setColor(C('#FFFFFF'));
      p.setAlphaf(this.flash * 0.35);
      c.drawRect(R(0, 0, width, height), p);
      p.setAlphaf(1);
    }

    return rec.finishRecordingAsPicture();
  }

  private drawCrane(c: SkCanvas, s: GameState) {
    const t = this.theme;
    const st = this.stroke;
    const p = this.p;
    const jibY = 92;
    const jibH = 16;

    // kafes kiriş
    st.setColor(C(t.crane));
    st.setStrokeWidth(3);
    c.drawLine(-SPAN, jibY, VIEW_W + SPAN, jibY, st);
    c.drawLine(-SPAN, jibY + jibH, VIEW_W + SPAN, jibY + jibH, st);
    st.setStrokeWidth(1.6);
    for (let x = -SPAN; x < VIEW_W + SPAN; x += 16) {
      c.drawLine(x, jibY + jibH, x + 8, jibY, st);
      c.drawLine(x + 8, jibY, x + 16, jibY + jibH, st);
    }

    // araba
    const cx = VIEW_W / 2;
    p.setColor(C(t.craneDark));
    c.drawRRect(Skia.RRectXY(R(cx - 16, jibY + jibH - 2, 32, 12), 3, 3), p);
    p.setColor(C(t.crane));
    c.drawCircle(cx - 9, jibY + jibH - 2, 3, p);
    c.drawCircle(cx + 9, jibY + jibH - 2, 3, p);

    // kanca: sallanırken bloğa bağlı, bırakınca yukarı toplanır
    const end = ropeEnd(s);
    if (end) {
      this.hook.x = end.x;
      this.hook.y = end.y;
    }
    const hx = this.hook.x;
    const hy = this.hook.y;

    st.setColor(C(t.cable));
    st.setStrokeWidth(1.6);
    c.drawLine(cx - 3, jibY + jibH + 10, cx - 1, PIVOT_Y, st);
    c.drawLine(cx + 3, jibY + jibH + 10, cx + 1, PIVOT_Y, st);
    p.setColor(C(t.craneDark));
    c.drawCircle(cx, PIVOT_Y, 4.5, p);

    c.drawLine(cx, PIVOT_Y, hx, hy - 12, st);
    if (end && s.cur) {
      st.setStrokeWidth(1.2);
      c.drawLine(hx, hy - 12, s.cur.x + 8, s.cur.y, st);
      c.drawLine(hx, hy - 12, s.cur.x + BLOCK - 8, s.cur.y, st);
    }
    p.setColor(C(t.crane));
    c.drawRRect(Skia.RRectXY(R(hx - 5, hy - 18, 10, 8), 2, 2), p);
  }

  private drawFx(c: SkCanvas) {
    const p = this.p;
    for (const q of this.particles) {
      const a = Math.max(0, Math.min(1, q.life / q.max));
      p.setColor(C(q.color));
      p.setAlphaf(q.round ? a * 0.55 : a);
      if (q.round) {
        c.drawCircle(q.x, q.y, q.size * (q.g < 500 ? 1.4 - a * 0.4 : 0.5), p);
      } else {
        c.save();
        c.rotate(q.rot, q.x, q.y);
        c.drawRect(R(q.x - q.size / 2, q.y - q.size / 4, q.size, q.size / 2), p);
        c.restore();
      }
    }
    p.setAlphaf(1);

    const st = this.stroke;
    for (const r of this.rings) {
      const e = 1 - Math.pow(1 - r.t, 3);
      st.setColor(C(r.color));
      st.setAlphaf((1 - r.t) * 0.9);
      st.setStrokeWidth(3 * (1 - r.t) + 0.5);
      c.drawCircle(r.x, r.y, BLOCK * 0.5 + e * BLOCK * 1.6, st);
    }
    st.setAlphaf(1);
  }

  private step(dt: number, s: GameState) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.8);

    if (!ropeEnd(s)) {
      // kanca yukarı toplanır
      this.hook.x += (VIEW_W / 2 - this.hook.x) * Math.min(1, dt * 5);
      this.hook.y += (PIVOT_Y + 46 - this.hook.y) * Math.min(1, dt * 5);
    }

    if (this.particles.length) {
      for (const q of this.particles) {
        q.vy += q.g * dt;
        q.vx *= q.g < 500 ? 1 - dt * 2.5 : 1;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.rot += q.vr * dt;
        q.life -= dt;
      }
      this.particles = this.particles.filter((q) => q.life > 0);
    }
    if (this.rings.length) {
      for (const r of this.rings) r.t += dt * 1.8;
      this.rings = this.rings.filter((r) => r.t < 1);
    }
  }
}
