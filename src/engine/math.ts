// Math.sin motorlar arasında son basamakta farklı çıkabiliyor (Hermes / JSC / V8).
// Tekrar oynatma (replay) her yerde aynı sonucu versin diye kendi sin'imizi kullanıyoruz.

const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;

export function dsin(x: number): number {
  x -= TWO_PI * Math.round(x / TWO_PI);
  if (x > HALF_PI) x = Math.PI - x;
  else if (x < -HALF_PI) x = -Math.PI - x;
  const x2 = x * x;
  // taylor, x^13'e kadar (horner): [-pi/2, pi/2] aralığında hata ~1e-10
  let p = 1 / 6227020800;
  p = p * x2 - 1 / 39916800;
  p = p * x2 + 1 / 362880;
  p = p * x2 - 1 / 5040;
  p = p * x2 + 1 / 120;
  p = p * x2 - 1 / 6;
  p = p * x2 + 1;
  return x * p;
}

export function dcos(x: number): number {
  return dsin(x + HALF_PI);
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// mulberry32 — durumu tek bir sayı olarak saklıyoruz ki oyun durumu kopyalanabilsin
export function nextRandom(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// gün bazlı seed: "2026-11-06" -> sayı (FNV-1a)
export function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
