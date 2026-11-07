import {
  PaintStyle,
  Skia,
  TileMode,
  vec,
  type SkCanvas,
  type SkPicture,
  type SkShader,
} from '@shopify/react-native-skia';
import {
  BLOCK,
  GROUND_Y,
  PIVOT_Y,
  VIEW_H,
  VIEW_W,
  WEATHER,
  DIFFICULTY,
  PERFECT_TOL,
  blockViewX,
  leanAt,
  levelTop,
  nextRandom,
  predictOffset,
  ropeEnd,
  type GameEvent,
  type GameState,
  type ToppledBlock,
} from '@/engine';
import { alpha, mix, smooth } from './color';
import { C, R, linear, paint, record } from './draw';
import { DEPTH, TOP, drawFloor } from './floors';
import type { SkyTheme } from './themes';

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

// yağmur damlası ya da rüzgâr çizgisi (görsel, oyunu etkilemez)
type Streak = { x: number; y: number; vx: number; vy: number; len: number; life: number; rain: boolean };

const GHOST_GAP = 140; // hayalet kule oyuncunun kulesinin bu kadar sağında

// devrilen bölüm: önce pivot (destek katın kenarı) etrafında katı cisim gibi döner,
// ağırlık merkezi kenarı iyice geçince serbest düşer
type Debris = {
  blocks: ToppledBlock[];
  px: number;
  py: number;
  dir: 1 | -1;
  angle: number; // derece
  av: number; // derece/sn
  fall: number;
  fallV: number;
  driftX: number;
};

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
  private debris: Debris[] = [];
  private flash = 0;
  private shake = 0;
  private time = 0;
  private hook = { x: VIEW_W / 2, y: PIVOT_Y + 40 };

  private skin = 'classic';
  private craneColor: string | null = null;
  private craneDark: string | null = null;

  private streaks: Streak[] = [];
  private bolt: { pts: [number, number][]; t: number } | null = null;
  private lightning = 0;
  private boltIn = 4;

  private p = paint();
  private stroke = paint();
  private layerPaint = paint();
  private dash = Skia.PathEffect.MakeDash([6, 5], 0);
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

  setSkin(skin: string) {
    if (skin === this.skin) return;
    this.skin = skin;
    this.blockPics.clear();
  }

  setCrane(color: string | null, dark: string | null) {
    this.craneColor = color;
    this.craneDark = dark;
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
    // ufuk rengine yakın, ince yatay bulut şeritleri (stratus). Yuvarlak top
    // bulutlar bu gökyüzünde leke gibi duruyordu.
    const tint = mix(this.theme.skyLow[1], '#FFFFFF', 0.45);
    return record(
      VIEW_W + SPAN * 2,
      4000,
      (c) => {
        const p = paint();
        for (let i = 0; i < 12; i++) {
          const cx = -140 + r() * (VIEW_W + 280);
          // dünya yüksekliği: yerden 700 ile 3500 arası
          const cy = 3800 - (700 + i * 240 + r() * 120);
          const n = 2 + Math.floor(r() * 2);
          for (let k = 0; k < n; k++) {
            const px = cx + (r() - 0.5) * 90;
            const py = cy + k * 7;
            const len = 90 + r() * 120;
            p.setShader(
              Skia.Shader.MakeRadialGradient(
                vec(0, 0),
                1,
                [C(alpha(tint, 0.13)), C(alpha(tint, 0))],
                null,
                TileMode.Clamp
              )
            );
            c.save();
            c.translate(px, py);
            c.scale(len, 5 + r() * 5);
            c.drawCircle(0, 0, 1, p);
            c.restore();
          }
        }
      },
      -SPAN,
      0
    );
  }

  private blockPic(style: number, lit: number, base: boolean): SkPicture {
    const key = `${this.skin}:${style}:${lit}:${base ? 1 : 0}`;
    let pic = this.blockPics.get(key);
    if (pic) return pic;
    pic = record(
      BLOCK + DEPTH + 4,
      BLOCK + TOP + 4,
      (c) => drawFloor(c, this.theme, this.skin, style, lit, base),
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
        if (ev.tipped) this.dust(ev.x, ev.y + BLOCK, Math.round(10 * lots), 0.7);
        break;
      case 'topple':
        this.debris.push({
          blocks: ev.blocks,
          px: ev.pivotX,
          py: ev.pivotY,
          dir: ev.dir,
          angle: 0,
          av: ev.dir * 20,
          fall: 0,
          fallV: 0,
          driftX: 0,
        });
        this.dust(ev.pivotX, ev.pivotY, Math.round(22 * lots), 1.1);
        if (!this.reducedMotion) this.shake = 0.7;
        break;
      case 'continue':
        this.debris = [];
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
    const base = mix(this.theme.skyLow[1], '#FFFFFF', 0.35);
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
        size: 3 + this.rand() * 5 * power,
        rot: 0,
        vr: 0,
        color: mix(base, '#FFFFFF', this.rand() * 0.3),
        round: true,
      });
    }
  }

  reset() {
    this.streaks = [];
    this.bolt = null;
    this.lightning = 0;
    this.particles = [];
    this.rings = [];
    this.debris = [];
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

  // ekran boyutu (px) verilir, sahne bir SkPicture olarak döner.
  // fitHeight: sahnenin sığdırılacağı yükseklik (ana menüde ekranın üst kısmı)
  render(
    s: GameState,
    dt: number,
    width: number,
    height: number,
    fitHeight = height,
    fitTop = 0,
    guide = false,
    ghost: GameState | null = null
  ): SkPicture {
    this.time += dt;
    this.step(dt, s);

    const k = Math.min(width / VIEW_W, fitHeight / VIEW_H);
    const ox = (width - VIEW_W * k) / 2;
    const oy = fitTop + fitHeight - VIEW_H * k;
    const t = this.theme;
    const alt = smooth(0, 3200, s.camY);

    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(R(0, 0, width, height));
    const p = this.p;

    // gökyüzü tüm ekranı kaplar
    p.setShader(this.skyShader(alt, oy, oy + GROUND_Y * k));
    c.drawRect(R(0, 0, width, height), p);
    p.setShader(null);

    // fırtına: gök kararır
    if (s.weather === 'storm') {
      p.setColor(C('#0A0C1C'));
      p.setAlphaf(0.38);
      c.drawRect(R(0, 0, width, height), p);
      p.setAlphaf(1);
    }

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

    // şimşek: göğe çizilen kısa ömürlü kırık çizgi
    if (this.bolt) {
      const st = this.stroke;
      st.setColor(C('#F2F4FF'));
      st.setAlphaf(Math.min(1, this.bolt.t * 6));
      st.setStrokeWidth(2.4);
      for (let i = 1; i < this.bolt.pts.length; i++) {
        const [x0, y0] = this.bolt.pts[i - 1];
        const [x1, y1] = this.bolt.pts[i];
        c.drawLine(x0, y0, x1, y1, st);
      }
      st.setAlphaf(1);
    }

    // rüzgâr çizgileri: kulenin arkasında
    this.drawStreaks(c, false);

    // zemin
    const gy = GROUND_Y + s.camY;
    const below = (height - fitTop - fitHeight) / k;
    if (gy < VIEW_H + 40 + below) {
      p.setShader(linear(0, gy, 0, gy + 160, [t.ground, mix(t.ground, '#000000', 0.5)]));
      c.drawRect(R(-SPAN, gy, VIEW_W + SPAN * 2, 400 + below), p);
      p.setShader(null);
      p.setColor(C(t.groundEdge));
      p.setAlphaf(0.8);
      c.drawRect(R(-SPAN, gy, VIEW_W + SPAN * 2, 2), p);
      p.setAlphaf(0.18);
      for (let x = -SPAN + 10; x < VIEW_W + SPAN; x += 46) c.drawRect(R(x, gy + 46, 22, 3), p);
      p.setAlphaf(1);

      // kulenin zemine düşen yumuşak gölgesi
      if (s.blocks.length) {
        const bx = blockViewX(s, 0);
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

    // sis: şehrin üstüne yoğun pus bantları
    if (s.weather === 'fog') {
      const fog = mix(t.skyLow[1], '#FFFFFF', 0.55);
      p.setShader(linear(0, gy - 360, 0, gy, [alpha(fog, 0), alpha(fog, 0.55)]));
      c.drawRect(R(-SPAN, gy - 360, VIEW_W + SPAN * 2, 362), p);
      p.setShader(linear(0, 120, 0, 520, [alpha(fog, 0), alpha(fog, 0.28), alpha(fog, 0)]));
      c.drawRect(R(-SPAN, 120, VIEW_W + SPAN * 2, 400), p);
      p.setShader(null);
    }

    if (ghost) this.drawGhost(c, s, ghost);

    // kule: katlar düz durur, sadece esneme kadar kayar. Eğilen bir kirişte
    // olduğu gibi her kat o noktadaki eğim kadar çok az döner.
    const n = s.blocks.length;
    for (let i = 0; i < n; i++) {
      const b = s.blocks[i];
      const y = levelTop(b.level) + s.camY;
      if (y > VIEW_H + BLOCK || y < -BLOCK * 2 - 400) continue;
      const x = blockViewX(s, i) - BLOCK / 2;
      const slope = i > 0 ? (Math.atan((leanAt(s, i) - leanAt(s, i - 1)) / BLOCK) * 180) / Math.PI : 0;
      c.save();
      c.translate(x, y);
      if (Math.abs(slope) > 0.05) c.rotate(slope, BLOCK / 2, BLOCK);
      c.drawPicture(this.blockPic(b.style, b.lit, b.level === 0));
      c.restore();
    }

    if (guide) this.drawGuide(c, s);
    this.drawDebris(c);
    this.drawCrane(c, s);

    if (s.cur) {
      c.save();
      c.translate(s.cur.x, s.cur.y);
      if (s.cur.rot) c.rotate(s.cur.rot, BLOCK / 2, BLOCK);
      c.drawPicture(this.blockPic(s.cur.style, s.cur.lit, n === 0 && s.phase !== 'falling'));
      c.restore();
    }

    this.drawFx(c);
    // yağmur her şeyin önünde
    this.drawStreaks(c, true);
    c.restore();

    if (s.weather === 'fog') {
      p.setColor(C(mix(t.skyLow[1], '#FFFFFF', 0.6)));
      p.setAlphaf(0.1);
      c.drawRect(R(0, 0, width, height), p);
      p.setAlphaf(1);
    }
    if (this.lightning > 0) {
      p.setColor(C('#E8EDFF'));
      p.setAlphaf(this.lightning * 0.45);
      c.drawRect(R(0, 0, width, height), p);
      p.setAlphaf(1);
    }

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

    const crane = this.craneColor ?? t.crane;
    const craneDark = this.craneDark ?? t.craneDark;

    // kafes kiriş
    st.setColor(C(crane));
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
    p.setColor(C(craneDark));
    c.drawRRect(Skia.RRectXY(R(cx - 16, jibY + jibH - 2, 32, 12), 3, 3), p);
    p.setColor(C(crane));
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
    p.setColor(C(craneDark));
    c.drawCircle(cx, PIVOT_Y, 4.5, p);

    c.drawLine(cx, PIVOT_Y, hx, hy - 12, st);
    if (end && s.cur) {
      st.setStrokeWidth(1.2);
      c.drawLine(hx, hy - 12, s.cur.x + 8, s.cur.y, st);
      c.drawLine(hx, hy - 12, s.cur.x + BLOCK - 8, s.cur.y, st);
    }
    p.setColor(C(crane));
    c.drawRRect(Skia.RRectXY(R(hx - 5, hy - 18, 10, 8), 2, 2), p);
  }

  private drawFx(c: SkCanvas) {
    const p = this.p;
    for (const q of this.particles) {
      const a = Math.max(0, Math.min(1, q.life / q.max));
      p.setColor(C(q.color));
      p.setAlphaf(q.round ? a * a * 0.4 : a);
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

  private stepWeather(dt: number, s: GameState) {
    const w = s.weather;
    const lots = this.reducedMotion ? 0.35 : 1;
    const wind = WEATHER[w].push * s.windDir + s.gust;

    if (w === 'storm') {
      // yağmur
      let n = Math.floor(240 * lots * dt + this.rand());
      while (n-- > 0) {
        this.streaks.push({
          x: -SPAN + this.rand() * (VIEW_W + SPAN * 2),
          y: -60 - this.rand() * 80,
          vx: wind * 6,
          vy: 900 + this.rand() * 300,
          len: 0.018,
          life: 1.6,
          rain: true,
        });
      }
      // şimşek
      this.boltIn -= dt;
      if (this.boltIn <= 0) {
        this.boltIn = 5 + this.rand() * 6;
        if (!this.reducedMotion) {
          this.lightning = 1;
          const pts: [number, number][] = [];
          let x = 40 + this.rand() * (VIEW_W - 80);
          for (let y = -20; y < 340; y += 24 + this.rand() * 26) {
            pts.push([x, y]);
            x += (this.rand() - 0.5) * 50;
          }
          this.bolt = { pts, t: 0.22 };
        }
      }
    }
    if (w === 'windy' || w === 'storm') {
      let n = Math.floor((w === 'storm' ? 26 : 16) * lots * dt + this.rand());
      const dir = Math.sign(wind) || 1;
      while (n-- > 0) {
        this.streaks.push({
          x: dir > 0 ? -SPAN : VIEW_W + SPAN,
          y: 60 + this.rand() * (VIEW_H - 160),
          vx: dir * (520 + this.rand() * 380),
          vy: 0,
          len: 0.06 + this.rand() * 0.08,
          life: 2,
          rain: false,
        });
      }
    }

    if (this.streaks.length) {
      for (const q of this.streaks) {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.life -= dt;
      }
      this.streaks = this.streaks.filter((q) => q.life > 0 && q.y < VIEW_H + 40);
    }
    if (this.lightning > 0) this.lightning = Math.max(0, this.lightning - dt * 3.5);
    if (this.bolt) {
      this.bolt.t -= dt;
      if (this.bolt.t <= 0) this.bolt = null;
    }
  }

  private drawStreaks(c: SkCanvas, rain: boolean) {
    if (!this.streaks.length) return;
    const st = this.stroke;
    st.setColor(C(rain ? '#C9D6FF' : '#FFFFFF'));
    st.setAlphaf(rain ? 0.35 : 0.16);
    st.setStrokeWidth(rain ? 1.2 : 1);
    for (const q of this.streaks) {
      if (q.rain !== rain) continue;
      c.drawLine(q.x, q.y, q.x - q.vx * q.len, q.y - q.vy * q.len, st);
    }
    st.setAlphaf(1);
  }

  // Hayalet: rekor koşunun kaydı aynı anda oynatılır, kulesi yanda yarı saydam yükselir.
  // Tepesinin hizasındaki kesik çizgi geçilmesi gereken yüksekliği gösterir.
  private drawGhost(c: SkCanvas, s: GameState, g: GameState) {
    const n = g.blocks.length;
    if (!n) return;
    const base = (s.blocks.length ? s.blocks[0].cx : VIEW_W / 2) + GHOST_GAP;
    const g0 = g.blocks[0].cx;
    this.layerPaint.setAlphaf(0.38);
    c.saveLayer(this.layerPaint);
    for (let i = 0; i < n; i++) {
      const y = levelTop(i) + s.camY;
      if (y > VIEW_H + BLOCK || y < -BLOCK * 2 - 400) continue;
      const b = g.blocks[i];
      c.save();
      c.translate(base + (b.cx - g0) + s.camX + leanAt(g, i) - BLOCK / 2, y);
      c.drawPicture(this.blockPic(b.style, b.lit, i === 0));
      c.restore();
    }
    c.restore();

    const top = levelTop(n - 1) + s.camY;
    if (top > -40 && top < VIEW_H) {
      const st = this.stroke;
      st.setColor(C('#FFFFFF'));
      st.setAlphaf(0.4);
      st.setStrokeWidth(1.2);
      st.setPathEffect(this.dash);
      c.drawLine(-SPAN, top, VIEW_W + SPAN, top, st);
      st.setPathEffect(null);
      st.setAlphaf(1);
    }
  }

  private step(dt: number, s: GameState) {
    this.stepWeather(dt, s);
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
    if (this.debris.length) {
      for (const d of this.debris) {
        // devrilme: açı büyüdükçe yerçekiminin torku artar (sin θ)
        const th = (Math.abs(d.angle) * Math.PI) / 180;
        d.av += d.dir * (90 + 520 * Math.sin(th)) * dt;
        d.angle += d.av * dt;
        // ağırlık merkezi kenarı iyice geçince destekten kopar
        if (Math.abs(d.angle) > 28) {
          d.fallV += 1250 * dt;
          d.fall += d.fallV * dt;
          d.driftX += d.dir * 60 * dt;
        }
      }
      this.debris = this.debris.filter((d) => d.fall < 1600);
    }
  }

  // nişan yardımı: şimdi bırakılsa katın ineceği yer, kesik çizgili hayalet kat
  private drawGuide(c: SkCanvas, s: GameState) {
    const d = predictOffset(s);
    if (d === null) return;
    const n = s.blocks.length;
    const cx = n ? blockViewX(s, n - 1) + d : s.camX + VIEW_W / 2 + d;
    const y = GROUND_Y - (n + 1) * BLOCK + s.camY;
    const a = Math.abs(d);
    const tol = DIFFICULTY[s.difficulty].tol;
    const col = n === 0 || a <= PERFECT_TOL * tol ? '#7CF3D4' : a <= BLOCK / 2 ? '#FFFFFF' : '#FF5D6C';
    const st = this.stroke;
    st.setColor(C(col));
    st.setAlphaf(0.75);
    st.setStrokeWidth(1.6);
    st.setPathEffect(this.dash);
    c.drawRRect(Skia.RRectXY(R(cx - BLOCK / 2, y, BLOCK, BLOCK), 3, 3), st);
    st.setPathEffect(null);
    this.p.setColor(C(col));
    this.p.setAlphaf(0.1);
    c.drawRect(R(cx - BLOCK / 2, y, BLOCK, BLOCK), this.p);
    this.p.setAlphaf(1);
    st.setAlphaf(1);
  }

  private drawDebris(c: SkCanvas) {
    for (const d of this.debris) {
      c.save();
      c.translate(d.px + d.driftX, d.py + d.fall);
      c.rotate(d.angle, 0, 0);
      for (const b of d.blocks) {
        c.save();
        c.translate(b.x - d.px, b.y - d.py);
        c.drawPicture(this.blockPic(b.style, b.lit, false));
        c.restore();
      }
      c.restore();
    }
  }
}
