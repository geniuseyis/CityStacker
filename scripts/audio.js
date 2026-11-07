// gen-sfx ve gen-music için ortak küçük DSP araçları

const fs = require('fs');

const SR = 44100;

function writeWav(file, samples, sr = SR) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
  console.log('  +', require('path').basename(file), `(${(n / sr).toFixed(2)}s, ${(buf.length / 1024).toFixed(0)} KB)`);
}

// tek kutuplu filtreler
function lowpass(x, cutoff, sr = SR) {
  const a = Math.exp((-2 * Math.PI * cutoff) / sr);
  const out = new Float64Array(x.length);
  let y = 0;
  for (let i = 0; i < x.length; i++) out[i] = y = (1 - a) * x[i] + a * y;
  return out;
}

function highpass(x, cutoff, sr = SR) {
  const lp = lowpass(x, cutoff, sr);
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] - lp[i];
  return out;
}

// basit schroeder reverb: paralel comb + seri allpass
function reverb(x, { mix = 0.25, size = 0.7, tail = 1.2, sr = SR } = {}) {
  const extra = Math.floor(sr * tail * size);
  const n = x.length + extra;
  const dry = new Float64Array(n);
  dry.set(x);
  const combs = [1557, 1617, 1491, 1422].map((d) => Math.floor((d * sr) / 44100));
  const wet = new Float64Array(n);
  const fb = 0.7 + size * 0.12;
  for (const d of combs) {
    const buf = new Float64Array(d);
    let idx = 0;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const out = buf[idx];
      lp = out * 0.6 + lp * 0.4; // tizler sönsün
      buf[idx] = dry[i] + lp * fb;
      wet[i] += out * 0.25;
      idx = (idx + 1) % d;
    }
  }
  for (const d of [225, 556].map((v) => Math.floor((v * sr) / 44100))) {
    const buf = new Float64Array(d);
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const b = buf[idx];
      const y = -wet[i] * 0.5 + b;
      buf[idx] = wet[i] + b * 0.5;
      wet[i] = y;
      idx = (idx + 1) % d;
    }
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = dry[i] * (1 - mix * 0.5) + wet[i] * mix;
  return out;
}

function normalize(x, peak = 0.8) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  const g = m > 0 ? peak / m : 1;
  // sonda kısa fade, tık olmasın
  const out = new Float64Array(x.length);
  const fade = Math.min(x.length, 400);
  for (let i = 0; i < x.length; i++) {
    const f = i > x.length - fade ? (x.length - i) / fade : 1;
    out[i] = x[i] * g * f;
  }
  return out;
}

// tekrarlanabilir gürültü
function noise(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

module.exports = { SR, writeWav, lowpass, highpass, reverb, normalize, noise };
