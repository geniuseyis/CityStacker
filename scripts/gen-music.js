/* Arka plan müziği: sakin, döngüye dikişsiz oturan bir şehir ambient'i.
 * Fmaj7 - Am7 - Dm9 - Cmaj7, 76 BPM, 8 ölçü. Kendi bestemiz, telif yok.
 * Çalıştır:  node scripts/gen-music.js
 */
const fs = require('fs');
const path = require('path');
const { writeWav, lowpass, highpass, reverb, noise } = require('./audio');

const SR = 22050; // müzik için yeterli, dosya yarı boyutta
const OUT = path.join(__dirname, '..', 'assets', 'music');
fs.mkdirSync(OUT, { recursive: true });

const BPM = 76;
const beat = 60 / BPM;
const BARS = 8;
const L = Math.floor(SR * beat * 4 * BARS);
const TAIL = Math.floor(SR * 4);
const n = L + TAIL;

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
// akorlar (midi): her biri 2 ölçü
const chords = [
  { root: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { root: 45, notes: [52, 55, 57, 60] }, // Am7
  { root: 38, notes: [53, 57, 60, 64, 62] }, // Dm9
  { root: 36, notes: [52, 55, 59, 62] }, // Cmaj7
];

const pad = new Float64Array(n);
const keys = new Float64Array(n);
const bass = new Float64Array(n);
const drums = new Float64Array(n);
const rnd = noise(11);

function voice(buf, f, start, dur, { vol, atk, rel, shape }) {
  const s0 = Math.floor(start * SR);
  const len = Math.floor((dur + rel) * SR);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < len && s0 + i < n; i++) {
    const t = i / SR;
    const env = t < atk ? t / atk : t < dur ? 1 : Math.max(0, 1 - (t - dur) / rel);
    p1 += (f * 1.0017) / SR;
    p2 += (f * 0.9983) / SR;
    buf[s0 + i] += shape(p1, p2, t) * env * vol;
  }
}

const tri = (p) => {
  const x = p % 1;
  return x < 0.5 ? 4 * x - 1 : 3 - 4 * x;
};

const barDur = beat * 4;

chords.forEach((c, ci) => {
  const t0 = ci * barDur * 2;

  // pad: yavaş giren, birbirine geçen akorlar
  for (const m of c.notes) {
    voice(pad, midi(m), t0, barDur * 2, {
      vol: 0.07,
      atk: 1.2,
      rel: 1.6,
      shape: (a, b) => 0.6 * tri(a) + 0.4 * Math.sin(b * 2 * Math.PI),
    });
  }

  // bas: kök nota, 1. ve 2.5. vuruşta
  for (let bar = 0; bar < 2; bar++) {
    for (const off of [0, 2.5]) {
      const st = t0 + bar * barDur + off * beat;
      voice(bass, midi(c.root), st, off ? beat * 1.2 : beat * 2.2, {
        vol: 0.22,
        atk: 0.02,
        rel: 0.3,
        shape: (a, _b, t) => Math.sin(a * 2 * Math.PI) * Math.exp(-t * 1.2),
      });
    }
  }

  // tuşlar: akor seslerinden sekizlik arpej, bazı notalar boş
  const up = c.notes.map((m) => m + 12);
  const pattern = [0, 2, 1, 3, 2, 1, 3, 4];
  for (let k = 0; k < 16; k++) {
    if (k % 8 === 7 || (k % 4 === 3 && rnd() < 0.5)) continue;
    const m = up[pattern[k % 8] % up.length];
    voice(keys, midi(m), t0 + k * (beat / 2), beat * 0.4, {
      vol: 0.09,
      atk: 0.004,
      rel: 0.9,
      shape: (a, _b, t) => (Math.sin(a * 2 * Math.PI) + 0.25 * Math.sin(a * 4 * Math.PI)) * Math.exp(-t * 3.2),
    });
  }
});

// ritim: yumuşak kick (1 ve 3), hafif hi-hat sekizlik araları
for (let b = 0; b < BARS * 4; b++) {
  const st = Math.floor(b * beat * SR);
  if (b % 2 === 0) {
    let ph = 0;
    for (let i = 0; i < SR * 0.35; i++) {
      const t = i / SR;
      ph += (45 + 70 * Math.exp(-t * 30)) / SR;
      drums[st + i] += Math.sin(ph * 2 * Math.PI) * Math.exp(-t * 9) * 0.3;
    }
  }
  const hs = st + Math.floor((beat / 2) * SR);
  for (let i = 0; i < SR * 0.05; i++) drums[hs + i] += rnd() * Math.exp(-(i / SR) * 90) * 0.05;
}

const drumsF = highpass(drums, 30, SR);
const space = reverb(
  (() => {
    const m = new Float64Array(n);
    const pl = lowpass(pad, 1600, SR);
    for (let i = 0; i < n; i++) m[i] = pl[i] + keys[i];
    return m;
  })(),
  { mix: 0.45, size: 0.95, tail: 0.1, sr: SR }
);

const bassF = lowpass(bass, 380, SR);
const mixed = new Float64Array(n);
for (let i = 0; i < n; i++) mixed[i] = (space[i] || 0) + bassF[i] + drumsF[i];

// döngü: L'den sonra taşan kuyruğu başa katla, dikiş duyulmasın
const loop = new Float64Array(L);
for (let i = 0; i < n; i++) loop[i % L] += mixed[i] || 0;

// yumuşak limiter
let peak = 0;
for (const v of loop) peak = Math.max(peak, Math.abs(v));
const g = 0.7 / peak;
for (let i = 0; i < L; i++) loop[i] = Math.tanh(loop[i] * g * 1.1) * 0.9;

writeWav(path.join(OUT, 'bgm.wav'), loop, SR);
console.log('Bitti.');
