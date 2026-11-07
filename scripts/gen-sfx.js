/* Ses efektlerini üretir (WAV, 16-bit mono, 44.1 kHz). Hepsi sentez, telif yok.
 * Çalıştır:  node scripts/gen-sfx.js
 */
const fs = require('fs');
const path = require('path');
const { SR, writeWav, lowpass, highpass, reverb, normalize, noise } = require('./audio');

const OUT = path.join(__dirname, '..', 'assets', 'sfx');
fs.mkdirSync(OUT, { recursive: true });

const len = (s) => Math.floor(SR * s);
const rnd = noise(7);

// beton/ahşap karışımı tok bir "tak": düşen ton + filtrelenmiş vuruş
function thud({ f0 = 150, f1 = 70, dur = 0.28, body = 0.9, click = 0.35, bright = 2400 }) {
  const n = len(dur);
  const out = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t * 40);
    ph += f / SR;
    out[i] = Math.sin(ph * 2 * Math.PI) * Math.exp(-t * 18) * body;
  }
  const tr = new Float64Array(n);
  for (let i = 0; i < len(0.03); i++) tr[i] = rnd() * Math.exp(-(i / SR) * 160) * click;
  const trf = lowpass(tr, bright);
  for (let i = 0; i < n; i++) out[i] += trf[i];
  return out;
}

// çan / cam: armonik olmayan kısmi sesler, uzun sönüm
function chime(freqs, { dur = 1.2, decay = 3.2, vol = 0.5, delayStep = 0 } = {}) {
  const n = len(dur);
  const out = new Float64Array(n);
  freqs.forEach((f, k) => {
    const start = len(delayStep * k);
    const partials = [
      [1, 1],
      [2.01, 0.35],
      [3.98, 0.12],
      [5.43, 0.05],
    ];
    for (const [m, a] of partials) {
      let ph = Math.random();
      for (let i = start; i < n; i++) {
        const t = (i - start) / SR;
        ph += (f * m) / SR;
        const atk = Math.min(1, t / 0.004);
        out[i] += Math.sin(ph * 2 * Math.PI) * a * atk * Math.exp(-t * decay * (1 + m * 0.35)) * vol;
      }
    }
  });
  return out;
}

function add(a, b, gain = 1, offset = 0) {
  const n = Math.max(a.length, b.length + offset);
  const out = new Float64Array(n);
  out.set(a);
  for (let i = 0; i < b.length; i++) out[i + offset] += b[i] * gain;
  return out;
}

console.log('Ses efektleri üretiliyor →', OUT);

// DROP — halat bırakıldı: kısa hava sesi + ince metal tık
(() => {
  const n = len(0.22);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    w[i] = rnd() * Math.sin(Math.PI * t) * 0.5;
  }
  let s = highpass(lowpass(w, 2200), 500);
  const tick = chime([2600], { dur: 0.12, decay: 40, vol: 0.18 });
  s = add(s, tick);
  writeWav(path.join(OUT, 'drop.wav'), normalize(s, 0.5));
})();

// PLACE — kat oturdu
(() => {
  const s = thud({ f0: 170, f1: 78, dur: 0.32 });
  writeWav(path.join(OUT, 'place.wav'), normalize(reverb(s, { mix: 0.12, size: 0.5 }), 0.8));
})();

// PERFECT — tok vuruş + üstte parlayan akor (C6 E6 G6), hafif arpej
(() => {
  const base = thud({ f0: 190, f1: 90, dur: 0.3, body: 0.7, click: 0.25 });
  const bell = chime([1046.5, 1318.5, 1568], { dur: 1.3, decay: 3, vol: 0.22, delayStep: 0.045 });
  const s = add(base, bell, 1, len(0.01));
  writeWav(path.join(OUT, 'perfect.wav'), normalize(reverb(s, { mix: 0.28, size: 0.8 }), 0.82));
})();

// CRASH — yıkılış: alçak gümbürtü + moloz
(() => {
  const n = len(1.4);
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    r[i] = rnd() * Math.exp(-t * 2.6) * (0.7 + 0.3 * Math.sin(t * 31));
  }
  let s = lowpass(lowpass(r, 420), 420);
  s = add(s, thud({ f0: 110, f1: 42, dur: 0.9, body: 1.2, click: 0.6, bright: 1200 }), 1);
  // moloz parçaları
  for (let k = 0; k < 14; k++) {
    const off = len(0.05 + Math.random() * 0.8);
    const c = thud({ f0: 400 + Math.random() * 500, f1: 200, dur: 0.06, body: 0.25, click: 0.3, bright: 3000 });
    s = add(s, c, 0.5 * Math.exp(-off / SR), off);
  }
  writeWav(path.join(OUT, 'crash.wav'), normalize(reverb(s, { mix: 0.2, size: 0.9 }), 0.85));
})();

// CLICK — arayüz: yumuşak, kısa
(() => {
  const s = chime([1760], { dur: 0.06, decay: 70, vol: 0.4 });
  const k = thud({ f0: 520, f1: 300, dur: 0.04, body: 0.2, click: 0.08, bright: 4000 });
  writeWav(path.join(OUT, 'click.wav'), normalize(add(s, k), 0.4));
})();

console.log('Bitti.');
