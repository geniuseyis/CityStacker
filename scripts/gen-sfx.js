/* Özgün 8-bit/retro ses efektleri üretir (WAV, 16-bit mono).
 * Çalıştır:  node scripts/gen-sfx.js
 */
const fs = require('fs');
const path = require('path');

const SR = 44100;
const OUT = path.join(__dirname, '..', 'assets', 'sfx');
fs.mkdirSync(OUT, { recursive: true });

function writeWav(name, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('  +', name, `(${(n / SR).toFixed(2)}s)`);
}

// dalga biçimleri
const square = (p) => (p % 1 < 0.5 ? 1 : -1);
const sine = (p) => Math.sin(p * 2 * Math.PI);
const tri = (p) => {
  const x = p % 1;
  return x < 0.5 ? 4 * x - 1 : 3 - 4 * x;
};

// tek ton üret: freq sabit ya da [bas, son] kayan; env: attack/decay oranlı
function tone({ dur, freq, wave = square, vol = 0.5, decay = 4 }) {
  const N = Math.floor(SR * dur);
  const out = new Array(N);
  const f0 = Array.isArray(freq) ? freq[0] : freq;
  const f1 = Array.isArray(freq) ? freq[1] : freq;
  let phase = 0;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const f = f0 + (f1 - f0) * t;
    phase += f / SR;
    // zarf: hızlı atak + üstel sönüm
    const attack = Math.min(1, (i / SR) / 0.005);
    const env = attack * Math.exp(-decay * t);
    out[i] = wave(phase) * env * vol;
  }
  return out;
}

function mix(...arrs) {
  const N = Math.max(...arrs.map((a) => a.length));
  const out = new Array(N).fill(0);
  for (const a of arrs) for (let i = 0; i < a.length; i++) out[i] += a[i];
  return out;
}

function concat(...arrs) {
  return [].concat(...arrs);
}

function silence(dur) {
  return new Array(Math.floor(SR * dur)).fill(0);
}

console.log('Ses efektleri üretiliyor →', OUT);

// 1) DROP — bloğu bırakma: kısa aşağı doğru chirp
writeWav('drop.wav', tone({ dur: 0.12, freq: [600, 240], wave: square, vol: 0.4, decay: 6 }));

// 2) PLACE — normal yerleşme: tek tatmin edici blip
writeWav('place.wav', tone({ dur: 0.1, freq: [330, 440], wave: tri, vol: 0.5, decay: 7 }));

// 3) PERFECT — mükemmel: yükselen üç notalı arpej
writeWav(
  'perfect.wav',
  concat(
    tone({ dur: 0.07, freq: 660, wave: square, vol: 0.4, decay: 5 }),
    tone({ dur: 0.07, freq: 880, wave: square, vol: 0.4, decay: 5 }),
    tone({ dur: 0.14, freq: 1320, wave: square, vol: 0.45, decay: 4 })
  )
);

// 4) CRASH — yıkılış: gürültülü, alçalan bas + parazit
(() => {
  const base = tone({ dur: 0.5, freq: [220, 60], wave: square, vol: 0.45, decay: 3 });
  for (let i = 0; i < base.length; i++) {
    const t = i / base.length;
    base[i] += (Math.random() * 2 - 1) * 0.35 * Math.exp(-2.5 * t); // patlama gürültüsü
  }
  writeWav('crash.wav', base);
})();

// 5) CLICK — arayüz tık sesi
writeWav('click.wav', tone({ dur: 0.05, freq: [900, 700], wave: square, vol: 0.3, decay: 9 }));

console.log('Bitti.');
