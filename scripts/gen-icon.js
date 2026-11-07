/* Uygulama ikonu, android adaptive katmanları ve açılış görselini çizer.
 * Oyundaki blok çizimiyle aynı dili kullanır (canvaskit = Skia'nın wasm hali).
 * Çalıştır:  node scripts/gen-icon.js
 */
const fs = require('fs');
const path = require('path');
const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');

const OUT = path.join(__dirname, '..', 'assets');

const SKY = ['#2B2D6E', '#8A5A8E', '#F4A77E'];
const BLOCKS = [
  { face: '#7A8CC6', low: '#6274AE', side: '#4B5A8C', slab: '#B3C0EA' },
  { face: '#E58A6B', low: '#CC6F52', side: '#A5553F', slab: '#F7B79F' },
  { face: '#EFE9DF', low: '#D8CFC1', side: '#B5AA9A', slab: '#FFFFFF' },
];
const ACCENT = '#FF8A5C';
const CABLE = '#1B1B33';

CanvasKitInit({ locateFile: (f) => require.resolve('canvaskit-wasm/bin/' + f) }).then((CK) => {
  const C = (hex, a = 1) => {
    const c = CK.parseColorString(hex);
    c[3] = a;
    return c;
  };
  const paint = (hex, a = 1) => {
    const p = new CK.Paint();
    p.setAntiAlias(true);
    p.setColor(C(hex, a));
    return p;
  };
  const linear = (x0, y0, x1, y1, cols, pos = null) =>
    CK.Shader.MakeLinearGradient(
      [x0, y0],
      [x1, y1],
      cols.map((c) => (typeof c === 'string' ? C(c) : c)),
      pos,
      CK.TileMode.Clamp
    );

  function save(name, w, h, draw) {
    const surface = CK.MakeSurface(w, h);
    const c = surface.getCanvas();
    c.clear(CK.TRANSPARENT);
    draw(c, w, h);
    const img = surface.makeImageSnapshot();
    fs.writeFileSync(path.join(OUT, name), img.encodeToBytes());
    img.delete();
    surface.delete();
    console.log('  +', name, `${w}x${h}`);
  }

  function sky(c, w, h) {
    const p = new CK.Paint();
    p.setShader(linear(0, 0, 0, h, SKY, [0, 0.55, 1]));
    c.drawRect(CK.XYWHRect(0, 0, w, h), p);
    // alçak güneş + ışıltı
    const g = new CK.Paint();
    g.setShader(
      CK.Shader.MakeRadialGradient(
        [w * 0.5, h * 0.62],
        w * 0.5,
        [C('#FFC9A1', 0.55), C('#FFC9A1', 0)],
        null,
        CK.TileMode.Clamp
      )
    );
    c.drawCircle(w * 0.5, h * 0.62, w * 0.5, g);
  }

  const poly = (...pts) =>
    CK.Path.MakeFromCmds([
      CK.MOVE_VERB,
      ...pts[0],
      ...pts.slice(1).flatMap((p) => [CK.LINE_VERB, ...p]),
      CK.CLOSE_VERB,
    ]);

  // tek kat: oyundaki blokla aynı (ön yüz, sağ yan, üst yüz, pencereler)
  function block(c, x, y, s, pal, opts = {}) {
    const D = s * 0.13;
    const T = s * 0.08;
    if (opts.mono) {
      const m = paint('#FFFFFF');
      c.drawRect(CK.XYWHRect(x, y, s, s), m);
      return;
    }
    c.drawPath(poly([x + s, y], [x + s + D, y - T], [x + s + D, y + s - T], [x + s, y + s]), paint(pal.side));
    c.drawPath(poly([x, y], [x + D, y - T], [x + s + D, y - T], [x + s, y]), paint(pal.slab));
    const face = new CK.Paint();
    face.setAntiAlias(true);
    face.setShader(linear(0, y, 0, y + s, [pal.face, pal.low]));
    c.drawRect(CK.XYWHRect(x, y, s, s), face);
    c.drawRect(CK.XYWHRect(x, y, s, s * 0.08), paint(pal.slab));

    const glass = new CK.Paint();
    glass.setAntiAlias(true);
    glass.setShader(linear(0, y, 0, y + s, ['#262B52', '#3A4378']));
    const lit = new CK.Paint();
    lit.setAntiAlias(true);
    lit.setShader(linear(0, y, 0, y + s, ['#FFE2B3', '#FFB870']));
    const cols = 3;
    const rows = 2;
    const gx = s * 0.06;
    const gy = s * 0.08;
    const ww = (s * 0.78 - gx * (cols - 1)) / cols;
    const wh = (s * 0.72 - gy * (rows - 1)) / rows;
    const on = opts.lit ?? 0b101101;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const i = r * cols + k;
        const wx = x + s * 0.11 + k * (ww + gx);
        const wy = y + s * 0.18 + r * (wh + gy);
        c.drawRRect(CK.RRectXY(CK.XYWHRect(wx, wy, ww, wh), s * 0.02, s * 0.02), (on >> i) & 1 ? lit : glass);
      }
    }
  }

  // iki kat oturmuş, üçüncüsü vinçte asılı ve hafif kaçık: oyunun tam o anı
  function mark(c, cx, baseY, s, opts = {}) {
    const ox = cx - s / 2 - s * 0.065;
    const gap = s * (opts.gap ?? 0.3);
    const swing = s * (opts.swing ?? 0.1);
    const hx = ox + swing;
    const hy = baseY - 3 * s - gap;

    if (!opts.mono) {
      const sh = new CK.Paint();
      sh.setAntiAlias(true);
      sh.setShader(
        CK.Shader.MakeRadialGradient(
          [cx, baseY],
          s * 0.9,
          [C('#000000', 0.35), C('#000000', 0)],
          null,
          CK.TileMode.Clamp
        )
      );
      c.save();
      c.scale(1, 0.16);
      c.drawCircle(cx, baseY / 0.16, s * 0.9, sh);
      c.restore();
    }

    block(c, ox, baseY - s, s, BLOCKS[0], { ...opts, lit: 0b011110 });
    block(c, ox, baseY - 2 * s, s, BLOCKS[1], { ...opts, lit: 0b101101 });
    block(c, hx, hy, s, BLOCKS[2], { ...opts, lit: 0b110011 });

    const kx = hx + s / 2;
    const line = paint(opts.mono ? '#FFFFFF' : CABLE);
    line.setStyle(CK.PaintStyle.Stroke);
    line.setStrokeCap(CK.StrokeCap.Round);
    line.setStrokeWidth(s * 0.035);
    c.drawLine(kx, opts.lineTop ?? hy - s, kx, hy - s * 0.3, line);
    line.setStrokeWidth(s * 0.025);
    c.drawLine(kx, hy - s * 0.22, hx + s * 0.14, hy - s * 0.02, line);
    c.drawLine(kx, hy - s * 0.22, hx + s * 0.86, hy - s * 0.02, line);
    const hook = paint(opts.mono ? '#FFFFFF' : ACCENT);
    c.drawRRect(CK.RRectXY(CK.XYWHRect(kx - s * 0.1, hy - s * 0.36, s * 0.2, s * 0.15), s * 0.04, s * 0.04), hook);
  }

  console.log('İkonlar çiziliyor →', OUT);

  // iOS / genel ikon: tam dolu, saydamlık yok
  save('icon.png', 1024, 1024, (c, w, h) => {
    sky(c, w, h);
    const ground = paint('#14142E');
    c.drawRect(CK.XYWHRect(0, h * 0.86, w, h * 0.14), ground);
    c.drawRect(CK.XYWHRect(0, h * 0.86, w, 6), paint(ACCENT, 0.9));
    mark(c, w / 2, h * 0.86, 228, { lineTop: -10 });
  });

  // android adaptive: arka plan + güvenli alanda ön plan
  save('android-icon-background.png', 512, 512, (c, w, h) => {
    sky(c, w, h);
    c.drawRect(CK.XYWHRect(0, h * 0.8, w, h * 0.2), paint('#14142E'));
    c.drawRect(CK.XYWHRect(0, h * 0.8, w, 3), paint(ACCENT, 0.9));
  });
  save('android-icon-foreground.png', 512, 512, (c, w, h) => {
    // güvenli alan merkezdeki ~%66
    mark(c, w / 2, h * 0.8, 76, { lineTop: h * 0.1 });
  });
  save('android-icon-monochrome.png', 432, 432, (c, w, h) => {
    mark(c, w / 2, h * 0.79, 64, { mono: true, lineTop: h * 0.12, gap: 0.25 });
  });

  // açılış: koyu zemin üstünde motif (arka plan rengi app.json'da)
  save('splash-icon.png', 1024, 1024, (c, w, h) => {
    mark(c, w / 2, h * 0.9, 230, { lineTop: h * 0.0 });
  });

  save('favicon.png', 48, 48, (c, w, h) => {
    sky(c, w, h);
    mark(c, w / 2, h * 0.94, 11, { lineTop: 0, gap: 0.2 });
  });

  console.log('Bitti.');
});
