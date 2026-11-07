import type { Difficulty } from './types';

// Motor sanal bir ekranda çalışır, renderer bunu cihaza ölçekler.
// Böylece telefon/tablet farkı oynanışı değiştirmez.
export const VIEW_W = 390;
export const VIEW_H = 844;

export const STEP = 1 / 120;

export const BLOCK = 64;
export const GROUND_H = 108;
export const GROUND_Y = VIEW_H - GROUND_H;

// vinç makarası (ekranda sabit)
export const PIVOT_Y = 150;

// Tek bir yerçekimi: hem sarkaç hem serbest düşüş bununla işler (birim/sn²)
export const GRAVITY = 1250;

// vinç, katı her zaman kulenin bu kadar üstüne indirir (kat altı ile kule tepesi arası)
export const HOOK_GAP = 70;
// kule bu yüksekliğe gelince kamera yukarı kaymaya başlar
export const DESIRED_TOP_Y = 484;
export const ROPE_MIN = 120;
export const ROPE_MAX = 520;

// salınımın yatay genliği (birim). Yükseldikçe artar, zorlukla çarpılır
export const SWING_BASE = 46;
export const SWING_STEP = 1.2;
export const SWING_MAX = 92;

// kule esnekliği: kaçık iniş yaya darbe verir
export const WOBBLE_FREQ = 0.7; // Hz, yükseldikçe düşer
export const WOBBLE_DAMP = 0.09; // sönüm oranı
export const WOBBLE_IMPULSE = 2.2; // birim/sn, kaçıklık başına
export const WIND_SPEED = 1.2;

// isabet toleransları (birim, kat merkezleri arası)
export const PERFECT_TOL = 7;
export const GOOD_TOL = 18;

export const CAMERA_LERP = 6;
export const RESPAWN_DELAY = 0.7;

export const COMBO_MAX = 10;
export const LIVES_MAX = 3;
export const MAX_CONTINUES = 2;
export const BLOCK_STYLES = 4;

export const DIFFICULTY: Record<Difficulty, { swing: number; wind: number; tol: number }> = {
  easy: { swing: 0.8, wind: 0.5, tol: 1.3 },
  normal: { swing: 1.0, wind: 1.0, tol: 1.0 },
  hard: { swing: 1.25, wind: 1.6, tol: 0.75 },
};

export const SCORE = {
  perfectBase: 100,
  perfectPerCombo: 25,
  goodBase: 40,
  goodPerCombo: 8,
  ok: 15,
};
