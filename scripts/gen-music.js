/* Özgün, döngüye uygun retro arka plan müziği üretir (WAV, 16-bit mono).
 * Basit bir akor dizisi + bas + arpej — kendi bestemiz, telif yok.
 * Çalıştır:  node scripts/gen-music.js
 */
const fs = require('fs');
const path = require('path');

const SR = 44100;
const OUT = path.join(__dirname, '..', 'assets', 'music');
fs.mkdirSync(OUT, { recursive: true });

const square = (p) => (p % 1 < 0.5 ? 1 : -1);
const tri = (p) => {
  const x = p % 1;
  return x < 0.5 ? 4 * x - 1 : 3 - 4 * x;
};

// nota: A4=440 referans, yarım ton uzaklığı
const note = (semis) => 440 * Math.pow(2, semis / 12);
// C majör çevresinde notalar (A4'e göre yarım ton)
const N = {
  C3: note(-21), E3: note(-17), G3: note(-14),
  A2: note(-24), C4: note(-9), E4: note(-5), G4: note(-2),
  D4: note(-7), B3: note(-10), F3: note(-16), A3: note(-12), F4: note(-4),
};

const BPM = 110;
const beat = 60 / BPM; // bir vuruş süresi
const barBeats = 4;
const bars = 4; // 4 akor → döngü
const total = beat * barBeats * bars;
const totalN = Math.floor(SR * total);
const out = new Float64Array(totalN);

// yumuşak zarf (background için sürdürülen)
function env(i, n) {
  const atk = SR * 0.012;
  const rel = SR * 0.05;
  if (i < atk) return i / atk;
  if (i > n - rel) return Math.max(0, (n - i) / rel);
  return 1;
}

function addNote(startSec, durSec, freq, wave, vol) {
  const start = Math.floor(startSec * SR);
  const n = Math.floor(durSec * SR);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const idx = start + i;
    if (idx >= totalN) break;
    phase += freq / SR;
    out[idx] += wave(phase) * env(i, n) * vol;
  }
}

// akor dizisi: C - G - Am - F (her biri 1 bar)
const chords = [
  { bass: N.C3, notes: [N.C4, N.E4, N.G4] },
  { bass: N.G3, notes: [N.D4, N.G4, N.B3] },
  { bass: N.A2, notes: [N.A3, N.C4, N.E4] },
  { bass: N.F3, notes: [N.F4, N.A3, N.C4] },
];

console.log('Müzik üretiliyor →', OUT);

for (let b = 0; b < bars; b++) {
  const barStart = b * barBeats * beat;
  const ch = chords[b % chords.length];

  // bas: bar boyunca sürer (square, düşük)
  addNote(barStart, barBeats * beat * 0.98, ch.bass, square, 0.14);

  // arpej: sekizlikler halinde akor notaları (tri)
  const eighth = beat / 2;
  for (let e = 0; e < barBeats * 2; e++) {
    const f = ch.notes[e % ch.notes.length];
    addNote(barStart + e * eighth, eighth * 0.9, f, tri, 0.11);
  }
}

// normalize + 16-bit yaz
let peak = 0;
for (let i = 0; i < totalN; i++) peak = Math.max(peak, Math.abs(out[i]));
const gain = peak > 0 ? 0.85 / peak : 1;

const buf = Buffer.alloc(44 + totalN * 2);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + totalN * 2, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(totalN * 2, 40);
for (let i = 0; i < totalN; i++) {
  const v = Math.max(-1, Math.min(1, out[i] * gain));
  buf.writeInt16LE((v * 32767) | 0, 44 + i * 2);
}
fs.writeFileSync(path.join(OUT, 'bgm.wav'), buf);
console.log(`  + bgm.wav (${total.toFixed(1)}s döngü)`);
console.log('Bitti.');
