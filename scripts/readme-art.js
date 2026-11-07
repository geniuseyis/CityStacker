/* README görselleri: gerçek ekran görüntülerini (docs/screenshots/raw) telefon
 * çerçevesine yerleştirip kapak ve tanıtım kartlarını çizer.
 * Çalıştır:  node scripts/readme-art.js
 */
const fs = require('fs');
const path = require('path');
const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit.js'); // JPEG kodlayıcı sadece full sürümde

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'docs', 'screenshots', 'raw');
const OUT = path.join(ROOT, 'docs', 'screenshots');
const FONTS = path.join(ROOT, 'node_modules', '@expo-google-fonts', 'sora');

const BG = '#0B0F1A';
const ACCENT = '#FF8A5C';
const GOLD = '#FFC15E';
const MINT = '#7CF3D4';
const TEXT = '#F4F6FB';
const MUTED = '#A3AABD';

CanvasKitInit({ locateFile: (f) => require.resolve('canvaskit-wasm/bin/full/' + f) }).then((CK) => {
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
  const face = (file) => {
    const data = fs.readFileSync(path.join(FONTS, file));
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    return (CK.Typeface.MakeTypefaceFromData || CK.Typeface.MakeFreeTypeFaceFromData)(buf);
  };
  const F = {
    black: face('800ExtraBold/Sora_800ExtraBold.ttf'),
    bold: face('700Bold/Sora_700Bold.ttf'),
    semi: face('600SemiBold/Sora_600SemiBold.ttf'),
    reg: face('400Regular/Sora_400Regular.ttf'),
  };
  const img = (name) => CK.MakeImageFromEncoded(fs.readFileSync(path.join(RAW, name)));

  /* ------------------------------ metin ------------------------------ */

  function width(str, tf, size) {
    const font = new CK.Font(tf, size);
    const ids = font.getGlyphIDs(str);
    const w = font.getGlyphWidths(ids).reduce((a, b) => a + b, 0);
    font.delete();
    return w;
  }

  function text(c, str, x, y, tf, size, color, opts = {}) {
    const font = new CK.Font(tf, size);
    if (opts.spacing) {
      // harf aralığı: tek tek çiz
      let cx = x;
      for (const ch of str) {
        c.drawText(ch, cx, y, paint(color, opts.alpha ?? 1), font);
        cx += width(ch, tf, size) + opts.spacing;
      }
      font.delete();
      return cx - x;
    }
    c.drawText(str, x, y, paint(color, opts.alpha ?? 1), font);
    font.delete();
    return width(str, tf, size);
  }

  // kelime kelime satıra böler
  function wrap(str, tf, size, max) {
    const lines = [];
    let line = '';
    for (const word of str.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (width(next, tf, size) > max && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  /* ---------------------------- arka plan ---------------------------- */

  function backdrop(c, w, h, glow = ACCENT, gx = 0.72, gy = 0.55) {
    c.drawRect(CK.XYWHRect(0, 0, w, h), paint(BG));
    const g = new CK.Paint();
    g.setShader(
      CK.Shader.MakeRadialGradient([w * gx, h * gy], h * 0.75, [C(glow, 0.22), C(glow, 0)], null, CK.TileMode.Clamp)
    );
    c.drawRect(CK.XYWHRect(0, 0, w, h), g);
    const g2 = new CK.Paint();
    g2.setShader(
      CK.Shader.MakeRadialGradient(
        [w * 0.08, h * 0.05],
        h * 0.6,
        [C('#5B4BC4', 0.16), C('#5B4BC4', 0)],
        null,
        CK.TileMode.Clamp
      )
    );
    c.drawRect(CK.XYWHRect(0, 0, w, h), g2);
    // ince ızgara
    const grid = paint('#FFFFFF', 0.035);
    for (let x = 0; x < w; x += 60) c.drawRect(CK.XYWHRect(x, 0, 1, h), grid);
    for (let y = 0; y < h; y += 60) c.drawRect(CK.XYWHRect(0, y, w, 1), grid);
  }

  /* ----------------------------- telefon ----------------------------- */

  // ekran görüntüsünün üst satırından (durum çubuğunun hemen altı) renk okur
  function sample(image, x, y) {
    const px = image.readPixels(x, y, {
      width: 1,
      height: 1,
      colorType: CK.ColorType.RGBA_8888,
      alphaType: CK.AlphaType.Unpremul,
      colorSpace: CK.ColorSpace.SRGB,
    });
    return px ? CK.Color(px[0], px[1], px[2], 1) : C(BG);
  }

  // Telefon çerçevesi. Emülatörün durum çubuğu temiz bir 9:41 ile değiştirilir.
  function phone(c, image, x, y, h, opts = {}) {
    const iw = image.width();
    const ih = image.height();
    const sw = (h * iw) / ih;
    const bezel = h * 0.022;
    const W = sw + bezel * 2;
    const H = h + bezel * 2;
    const r = W * 0.13;

    c.save();
    if (opts.rot) c.rotate(opts.rot, x + W / 2, y + H / 2);

    // gölge
    const sh = new CK.Paint();
    sh.setAntiAlias(true);
    sh.setColor(C('#000000', 0.55));
    sh.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, h * 0.035, false));
    c.drawRRect(CK.RRectXY(CK.XYWHRect(x + h * 0.01, y + h * 0.03, W, H), r, r), sh);

    // gövde
    const body = new CK.Paint();
    body.setAntiAlias(true);
    body.setShader(
      CK.Shader.MakeLinearGradient([x, y], [x + W, y + H], [C('#2A2F3E'), C('#0E1118')], null, CK.TileMode.Clamp)
    );
    c.drawRRect(CK.RRectXY(CK.XYWHRect(x, y, W, H), r, r), body);
    const rim = paint('#FFFFFF', 0.12);
    rim.setStyle(CK.PaintStyle.Stroke);
    rim.setStrokeWidth(2);
    c.drawRRect(CK.RRectXY(CK.XYWHRect(x + 1, y + 1, W - 2, H - 2), r, r), rim);

    // ekran
    const sx = x + bezel;
    const sy = y + bezel;
    const sr = r - bezel * 0.8;
    c.save();
    c.clipRRect(CK.RRectXY(CK.XYWHRect(sx, sy, sw, h), sr, sr), CK.ClipOp.Intersect, true);
    c.drawImageRectCubic(image, CK.XYWHRect(0, 0, iw, ih), CK.XYWHRect(sx, sy, sw, h), 1 / 3, 1 / 3, null);
    if (!opts.raw) {
      // durum çubuğu
      const k = h / ih;
      const bar = new CK.Paint();
      bar.setColor(sample(image, Math.floor(iw * 0.5), 122));
      c.drawRect(CK.XYWHRect(sx, sy, sw, 118 * k), bar);
      const fs1 = 40 * k;
      text(c, '9:41', sx + 62 * k, sy + 80 * k, F.semi, fs1, '#FFFFFF');
      // pil, sinyal
      const bx = sx + sw - 120 * k;
      const by = sy + 52 * k;
      const stroke = paint('#FFFFFF', 0.9);
      stroke.setStyle(CK.PaintStyle.Stroke);
      stroke.setStrokeWidth(3 * k);
      c.drawRRect(CK.RRectXY(CK.XYWHRect(bx, by, 58 * k, 28 * k), 7 * k, 7 * k), stroke);
      c.drawRRect(CK.RRectXY(CK.XYWHRect(bx + 5 * k, by + 5 * k, 42 * k, 18 * k), 4 * k, 4 * k), paint('#FFFFFF'));
      for (let i = 0; i < 4; i++) {
        const bh = (10 + i * 6) * k;
        c.drawRRect(
          CK.RRectXY(CK.XYWHRect(bx - 82 * k + i * 12 * k, by + 28 * k - bh, 8 * k, bh), 2 * k, 2 * k),
          paint('#FFFFFF', 0.9)
        );
      }
      // çentik
      c.drawRRect(
        CK.RRectXY(CK.XYWHRect(sx + sw / 2 - 120 * k, sy + 26 * k, 240 * k, 66 * k), 33 * k, 33 * k),
        paint('#05060A')
      );
    }
    if (opts.dim) c.drawRect(CK.XYWHRect(sx, sy, sw, h), paint('#000000', opts.dim));
    c.restore();
    c.restore();
    return W;
  }

  /* ------------------------------ kartlar ----------------------------- */

  function save(name, w, h, draw, quality = 90) {
    const surface = CK.MakeSurface(w, h);
    const c = surface.getCanvas();
    draw(c);
    const shot = surface.makeImageSnapshot();
    const bytes = name.endsWith('.png') ? shot.encodeToBytes() : shot.encodeToBytes(CK.ImageFormat.JPEG, quality);
    fs.writeFileSync(path.join(OUT, name), bytes);
    console.log('  +', name, `${w}x${h}`, `${(bytes.length / 1024).toFixed(0)} KB`);
    shot.delete();
    surface.delete();
  }

  function chip(c, label, x, y, size, opts = {}) {
    const pad = size * 0.9;
    const w = width(label, F.semi, size) + pad * 2;
    const h = size * 2.3;
    c.drawRRect(CK.RRectXY(CK.XYWHRect(x, y, w, h), h / 2, h / 2), paint('#FFFFFF', 0.06));
    const rim = paint('#FFFFFF', 0.14);
    rim.setStyle(CK.PaintStyle.Stroke);
    rim.setStrokeWidth(2);
    c.drawRRect(CK.RRectXY(CK.XYWHRect(x, y, w, h), h / 2, h / 2), rim);
    text(c, label, x + pad, y + h / 2 + size * 0.36, F.semi, size, opts.color ?? TEXT);
    return w;
  }

  // sol metin bloğu: rozet, başlık, açıklama, maddeler
  function copy(c, { n, tag, title, accent, body, bullets, tint = ACCENT }, x, y, maxW) {
    // rozet
    const ts = 30;
    const tw = width(tag, F.bold, ts) + tag.length * 6;
    const bw = 64 + 26 + tw + 36;
    c.drawRRect(CK.RRectXY(CK.XYWHRect(x, y, bw, 72), 36, 36), paint('#FFFFFF', 0.06));
    const rim = paint('#FFFFFF', 0.12);
    rim.setStyle(CK.PaintStyle.Stroke);
    rim.setStrokeWidth(2);
    c.drawRRect(CK.RRectXY(CK.XYWHRect(x, y, bw, 72), 36, 36), rim);
    c.drawRRect(CK.RRectXY(CK.XYWHRect(x + 12, y + 12, 64, 48), 24, 24), paint(tint));
    text(c, n, x + 44 - width(n, F.black, 26) / 2, y + 45, F.black, 26, '#1A0E08');
    text(c, tag, x + 96, y + 47, F.bold, ts, MUTED, { spacing: 6 });

    // başlık: son satır vurgu rengi
    let cy = y + 72 + 150;
    const size = 104;
    for (const line of title) {
      text(c, line, x - 4, cy, F.black, size, TEXT);
      cy += size * 1.02;
    }
    if (accent) {
      text(c, accent, x - 4, cy, F.black, size, tint);
      cy += size * 1.02;
    }

    // açıklama
    cy += 28;
    for (const line of wrap(body, F.reg, 40, maxW)) {
      text(c, line, x, cy, F.reg, 40, MUTED);
      cy += 58;
    }

    // maddeler
    cy += 30;
    for (const b of bullets) {
      c.drawCircle(x + 20, cy - 13, 20, paint(tint, 0.18));
      const tick = paint(tint);
      tick.setStyle(CK.PaintStyle.Stroke);
      tick.setStrokeWidth(4);
      tick.setStrokeCap(CK.StrokeCap.Round);
      c.drawLine(x + 11, cy - 13, x + 18, cy - 6, tick);
      c.drawLine(x + 18, cy - 6, x + 30, cy - 21, tick);
      text(c, b, x + 62, cy, F.semi, 36, TEXT);
      cy += 66;
    }
  }

  const W = 2400;
  const H = 1350;

  // iki telefonlu tanıtım kartı
  function slide(name, info, back, front, opts = {}) {
    save(name, W, H, (c) => {
      backdrop(c, W, H, info.tint ?? ACCENT);
      copy(c, info, 150, 250, 960);
      const fh = opts.frontH ?? 1170;
      const bh = opts.backH ?? 1020;
      if (back) phone(c, img(back), opts.backX ?? 1390, opts.backY ?? 230, bh, { dim: 0.18, raw: opts.backRaw });
      phone(c, img(front), opts.frontX ?? 1800, opts.frontY ?? 110, fh, { raw: opts.frontRaw });
    });
  }

  console.log('README görselleri çiziliyor →', OUT);

  // kapak
  save('hero.jpg', 2400, 1290, (c) => {
    backdrop(c, 2400, 1290, ACCENT, 0.74, 0.5);
    const icon = CK.MakeImageFromEncoded(fs.readFileSync(path.join(ROOT, 'assets', 'icon.png')));
    c.save();
    c.clipRRect(CK.RRectXY(CK.XYWHRect(150, 190, 140, 140), 34, 34), CK.ClipOp.Intersect, true);
    c.drawImageRectCubic(icon, CK.XYWHRect(0, 0, 1024, 1024), CK.XYWHRect(150, 190, 140, 140), 1 / 3, 1 / 3, null);
    c.restore();
    const ww = text(c, 'Plumbline', 322, 286, F.black, 76, TEXT);
    c.drawRect(CK.XYWHRect(322 + ww + 8, 268, 18, 18), paint(ACCENT));

    let y = 490;
    for (const [line, col] of [
      ['Doğru anı', TEXT],
      ['bekle,', ACCENT],
      ['kuleni dik.', TEXT],
    ]) {
      text(c, line, 142, y, F.black, 140, col);
      y += 142;
    }
    y += 10;
    for (const line of wrap(
      'Gerçek fizikle çalışan, iOS ve Android için modern bir kule oyunu. Vinç sallanır, rüzgâr eser, sen doğru anda bırakırsın.',
      F.reg,
      44,
      1000
    )) {
      text(c, line, 150, y, F.reg, 44, MUTED);
      y += 64;
    }
    y += 40;
    let x = 150;
    for (const label of ['React Native', 'Expo SDK 58', 'Skia', 'iOS · Android', 'TR · EN']) {
      x += chip(c, label, x, y, 32) + 18;
    }

    phone(c, img('home.png'), 1240, 240, 940, { rot: -7, dim: 0.15 });
    phone(c, img('ghost.png'), 1900, 240, 940, { rot: 7, dim: 0.15 });
    phone(c, img('storm.png'), 1570, 120, 1060);
  });

  slide(
    '01-play.jpg',
    {
      n: '01',
      tag: 'OYNANIŞ',
      title: ['Fizik gerçek,'],
      accent: 'kule senin.',
      body: 'Kat vinçte gerçek bir sarkaç gibi sallanır, bırakınca hızını koruyarak düşer. Ağırlık merkezi kenarı aşarsa devrilir.',
      bullets: ['Gerçek sarkaç ve momentum', 'Ağırlık merkezine göre devrilme', 'Üst üste mükemmel = kombo'],
    },
    'home.png',
    'play.png'
  );

  slide(
    '02-weather.jpg',
    {
      n: '02',
      tag: 'HAVA',
      title: ['Her oyun başka'],
      accent: 'bir gökyüzü.',
      body: 'Rüzgâr sallanan katı da düşen katı da iter. Fırtınada ani esintiler, yağmur ve şimşek; sisli havada görüş azalır.',
      bullets: ['Rüzgârlı · puan ×1,2', 'Fırtına · puan ×1,5', 'Sisli · puan ×1,15'],
      tint: '#7FA7FF',
    },
    'fog.png',
    'storm.png'
  );

  slide(
    '03-ghost.jpg',
    {
      n: '03',
      tag: 'HAYALET',
      title: ['Rekorunla'],
      accent: 'yarış.',
      body: 'En iyi oyununun kaydı yanında, aynı anda yeniden oynanır. Aynı başlangıç, aynı hava; tek fark senin elin.',
      bullets: ['Yarı saydam rekor kulesi', 'Tepesinde hedef çizgisi', 'Kayıt motorla birebir oynatılır'],
      tint: MINT,
    },
    'home.png',
    'ghost.png'
  );

  slide(
    '04-continue.jpg',
    {
      n: '04',
      tag: 'DEVAM',
      title: ['Düştün mü? Kaldığın'],
      accent: 'yerden devam.',
      body: 'Kat düşünce ya da kule yıkılınca oyun durur. Jetonla hak alıp kaldığın yerden sürdürürsün; reklam izleyerek bir kez bedava.',
      bullets: ['Hak fiyatı 1, 2, 3… jeton', 'Yanlışlıkla basmaya karşı korumalı', 'Pro: her oyunda 1 ücretsiz hak'],
    },
    'results.png',
    'continue.png'
  );

  slide(
    '05-daily.jpg',
    {
      n: '05',
      tag: 'GÜNLÜK',
      title: ['Her gün geri'],
      accent: 'gelmek için.',
      body: '7 günlük giriş serisi, her gün yenilenen üç görev ve reklam izleyerek bedava jeton. Rekorlar ekranında tüm geçmişin.',
      bullets: ['2 → 12 jetonluk seri', 'Görevler tarihten türetilir', 'Rekorlar ve istatistikler'],
      tint: GOLD,
    },
    'records.png',
    'daily.png'
  );

  slide(
    '06-style.jpg',
    {
      n: '06',
      tag: 'MAĞAZA',
      title: ['Kuleni kendine'],
      accent: 'göre giydir.',
      body: 'Yedi kat stili ve beş vinç rengi jetonla açılır. Cam kule, tuğla, ahşap, neon; bakır başlangıç paketinde, altın Pro’da.',
      bullets: ['Jeton paketleri ve başlangıç paketi', 'Kat stili ve vinç rengi', 'Türkiye’ye yerel TL fiyatları'],
    },
    'shop.png',
    'style.png'
  );

  slide(
    '07-pro.jpg',
    {
      n: '07',
      tag: 'PRO',
      title: ['Reklamsız,'],
      accent: 'kesintisiz.',
      body: 'Haftalık, aylık ya da ömür boyu. Reklam yok, her oyunda bir ücretsiz hak, her hafta jeton hediyesi ve tüm gökyüzleri.',
      bullets: ['Haftalık · aylık · ömür boyu', 'Her hafta 10 jeton', 'Satın alımları geri yükleme'],
      tint: GOLD,
    },
    'settings.png',
    'pro.png'
  );

  // paylaşım kartı: hikâye görseli telefonun yanında
  save('08-share.jpg', W, H, (c) => {
    backdrop(c, W, H, ACCENT);
    copy(
      c,
      {
        n: '08',
        tag: 'PAYLAŞ',
        title: ['Kuleni'],
        accent: 'göster.',
        body: 'Oyun sonunda kulen; kat stili, kat sayısı ve puanıyla hikâye boyutunda bir karta dönüşür. Paylaşım menüsü bir dokunuş uzakta.',
        bullets: ['1080 × 1920 hikâye kartı', 'Kendi kulen, kendi stilin', 'Cihazda çizilir, sunucu yok'],
      },
      150,
      250,
      960
    );
    phone(c, img('results.png'), 1330, 230, 1020, { dim: 0.18 });
    const card = img('share-card.png');
    const ch = 1120;
    const cw = (ch * card.width()) / card.height();
    const cx = 1760;
    const cy = 115;
    const sh = new CK.Paint();
    sh.setAntiAlias(true);
    sh.setColor(C('#000000', 0.55));
    sh.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, 40, false));
    c.drawRRect(CK.RRectXY(CK.XYWHRect(cx + 10, cy + 30, cw, ch), 36, 36), sh);
    c.save();
    c.clipRRect(CK.RRectXY(CK.XYWHRect(cx, cy, cw, ch), 36, 36), CK.ClipOp.Intersect, true);
    c.drawImageRectCubic(
      card,
      CK.XYWHRect(0, 0, card.width(), card.height()),
      CK.XYWHRect(cx, cy, cw, ch),
      1 / 3,
      1 / 3,
      null
    );
    c.restore();
  });

  // README başlığındaki küçük ikon
  save('app-icon.png', 168, 168, (c) => {
    const icon = CK.MakeImageFromEncoded(fs.readFileSync(path.join(ROOT, 'assets', 'icon.png')));
    c.clear(CK.TRANSPARENT);
    c.clipRRect(CK.RRectXY(CK.XYWHRect(0, 0, 168, 168), 38, 38), CK.ClipOp.Intersect, true);
    c.drawImageRectCubic(icon, CK.XYWHRect(0, 0, 1024, 1024), CK.XYWHRect(0, 0, 168, 168), 1 / 3, 1 / 3, null);
  });

  console.log('Bitti.');
});
