import type { Difficulty } from './types';

// Motor sanal bir ekranda çalışır, renderer bunu cihaza ölçekler.
// Böylece telefon/tablet farkı oynanışı değiştirmez.
export const VIEW_W = 390;
export const VIEW_H = 844;

export const STEP = 1 / 120;

export const BLOCK = 64;
export const GROUND_H = 108;
export const GROUND_Y = VIEW_H - GROUND_H;
export const PIVOT_Y = 150;
export const ROPE_LEN = 132;
export const DESIRED_TOP_Y = VIEW_H * 0.55;

// sarkaç
export const SPEED_BASE = 1.3;
export const SPEED_STEP = 0.05;
export const SPEED_MAX = 4.2;
export const SPEED_HARD_CAP = 6.5;
export const AMP_BASE = 0.42;
export const AMP_STEP = 0.012;
export const AMP_MAX = 0.8;

export const GRAVITY = 3400;
export const DROP_V0 = 240;
export const MISS_DRIFT_X = 36;

// isabet toleransları (px, blok merkezleri arası)
export const PERFECT_TOL = 6;
export const GOOD_TOL = 18;

// taban ile tepe arası kayma bunu geçerse kule yıkılır
export const MAX_DRIFT = BLOCK * 2.4;

export const SWAY_SPEED = 1.25;
export const CAMERA_LERP = 6;

export const COMBO_MAX = 10;
export const COMBO_SPEED_STEP = 0.11;
export const COMBO_UP_RATE = 3.5;
export const COMBO_DOWN_RATE = 0.7;

export const TILT_PER_OFFSET = 0.34;
export const TILT_MAX = 17;

export const LIVES_MAX = 3;
export const MAX_CONTINUES = 2;
export const BLOCK_STYLES = 4;

export const DIFFICULTY: Record<Difficulty, { speed: number; amp: number; drift: number; tol: number }> = {
  easy: { speed: 0.8, amp: 0.85, drift: 1.35, tol: 1.35 },
  normal: { speed: 1.05, amp: 1.0, drift: 1.0, tol: 1.0 },
  hard: { speed: 1.5, amp: 1.28, drift: 0.7, tol: 0.7 },
};

export const SCORE = {
  perfectBase: 100,
  perfectPerCombo: 25,
  goodBase: 40,
  goodPerCombo: 8,
  ok: 15,
};
