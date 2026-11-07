import {
  BLOCK,
  BLOCK_STYLES,
  CAMERA_LERP,
  DESIRED_TOP_Y,
  DIFFICULTY,
  GOOD_TOL,
  GRAVITY,
  GROUND_Y,
  HOOK_GAP,
  LIVES_MAX,
  MAX_CONTINUES,
  PERFECT_TOL,
  PIVOT_Y,
  RESPAWN_DELAY,
  ROPE_MAX,
  ROPE_MIN,
  SCORE,
  STEP,
  SWING_BASE,
  SWING_MAX,
  SWING_STEP,
  VIEW_H,
  VIEW_W,
  WIND_SPEED,
  WOBBLE_DAMP,
  WOBBLE_FREQ,
  WOBBLE_IMPULSE,
} from './constants';
import { clamp, dcos, dsin, nextRandom } from './math';
import type { Difficulty, GameState, Grade, Hanging, OverReason, ToppledBlock } from './types';

const HALF = BLOCK / 2;

export function createGame(seed: number, difficulty: Difficulty): GameState {
  const s: GameState = {
    seed: seed >>> 0,
    rng: seed | 0,
    difficulty,
    tick: 0,
    phase: 'swinging',
    overReason: null,
    waitT: 0,
    blocks: [],
    cur: null,
    rope: ROPE_MAX,
    theta: 0,
    omega: 0,
    side: 1,
    wob: 0,
    wobV: 0,
    windT: 0,
    camX: 0,
    camXTarget: 0,
    camY: 0,
    camYTarget: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    perfects: 0,
    lives: LIVES_MAX,
    continues: 0,
    inputs: [],
    events: [],
  };
  s.windT = nextRandom(s) * Math.PI * 2;
  s.side = nextRandom(s) < 0.5 ? 1 : -1;
  spawn(s);
  return s;
}

export const levelTop = (level: number) => GROUND_Y - (level + 1) * BLOCK;

/* ------------------------------ kule ------------------------------ */

// rüzgârın tepe noktasında yaptığı salınım; kule kısayken hiç yok
const windAmp = (s: GameState) => Math.min(10, Math.max(0, s.blocks.length - 5) * 0.6) * DIFFICULTY[s.difficulty].wind;

// referans yükseklikteki (LEAN_REF kat) yatay yer değiştirme: esneme + rüzgâr
export const towerSway = (s: GameState) => s.wob + windAmp(s) * dsin(s.windT);

// Konsol kiriş gibi: sehim yükseklikle büyür. Alçak kule rijittir, neredeyse
// kıpırdamaz; yükseldikçe belirgin salınır. Oran sabit bir referansa göre,
// kulenin o anki kat sayısına göre değil.
const LEAN_REF = 14;
const leanFactor = (level: number) => {
  if (level <= 0) return 0;
  const h = level / LEAN_REF;
  return Math.min(1.6, h * Math.sqrt(h));
};

export const leanAt = (s: GameState, level: number) => towerSway(s) * leanFactor(level);

// katın ekrandaki merkez x'i
export const blockViewX = (s: GameState, level: number) => s.blocks[level].cx + s.camX + leanAt(s, level);

// kule tepe yüzeyinin ekrandaki y'si (kat yoksa zemin)
const topSurface = (s: GameState, camY: number) => GROUND_Y - s.blocks.length * BLOCK + camY;

function retargetCamera(s: GameState) {
  const n = s.blocks.length;
  s.camXTarget = n ? VIEW_W / 2 - s.blocks[n - 1].cx : 0;
  const natural = GROUND_Y - n * BLOCK;
  s.camYTarget = Math.max(0, DESIRED_TOP_Y - natural);
}

/* ------------------------------ sarkaç ------------------------------ */

function hangPosition(s: GameState, h: Hanging) {
  const st = dsin(s.theta);
  const ct = dcos(s.theta);
  h.x = VIEW_W / 2 + s.rope * st - HALF;
  h.y = PIVOT_Y + s.rope * ct;
  // ip ucunun hızı: bırakıldığında kat bu hızla uçar
  h.vx = s.rope * ct * s.omega;
  h.vy = -s.rope * st * s.omega;
}

// vinç yeni katı kulenin hemen üstüne indirir ve yandan bırakır
function spawn(s: GameState) {
  const n = s.blocks.length;
  const hangTop = topSurface(s, s.camYTarget) - HOOK_GAP - BLOCK;
  s.rope = clamp(hangTop - PIVOT_Y, ROPE_MIN, ROPE_MAX);
  const amp = Math.min(SWING_MAX, SWING_BASE + n * SWING_STEP) * DIFFICULTY[s.difficulty].swing;
  s.side = s.side === 1 ? -1 : 1;
  s.theta = s.side * Math.min(0.9, amp / s.rope);
  s.omega = 0;

  let lit = 0;
  for (let i = 0; i < 6; i++) if (nextRandom(s) > 0.4) lit |= 1 << i;
  const h: Hanging = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, style: n % BLOCK_STYLES, lit };
  hangPosition(s, h);
  s.cur = h;
  s.phase = 'swinging';
}

/* ------------------------------ girdi ------------------------------ */

export function drop(s: GameState): boolean {
  if (s.phase !== 'swinging' || !s.cur) return false;
  s.inputs.push({ tick: s.tick, kind: 'drop' });
  s.phase = 'dropping';
  s.events.push({ type: 'drop' });
  return true;
}

export const canContinue = (s: GameState) => s.phase === 'over' && s.continues < MAX_CONTINUES;

// jeton ya da ödüllü reklam sonrası: bir hakla kaldığı yerden sürdür
export function continueRun(s: GameState): boolean {
  if (!canContinue(s)) return false;
  s.inputs.push({ tick: s.tick, kind: 'continue' });
  s.continues += 1;
  s.lives = 1;
  s.overReason = null;
  s.combo = 0;
  s.wob = 0;
  s.wobV = 0;
  retargetCamera(s);
  spawn(s);
  s.events.push({ type: 'continue' });
  return true;
}

/* ------------------------------ iniş ------------------------------ */

function loseLife(s: GameState) {
  s.lives -= 1;
  s.combo = 0;
}

function afterLoss(s: GameState, reason: OverReason) {
  if (s.lives > 0) {
    retargetCamera(s);
    spawn(s);
    s.events.push({ type: 'respawn' });
  } else {
    s.cur = null;
    s.phase = 'over';
    s.overReason = reason;
    s.events.push({ type: 'over', reason });
  }
}

function land(s: GameState) {
  const cur = s.cur!;
  const diff = DIFFICULTY[s.difficulty];
  const n = s.blocks.length;
  const x = cur.x + HALF;

  let cx: number;
  let d: number;
  if (n === 0) {
    cx = x - s.camX;
    d = cx - VIEW_W / 2;
  } else {
    d = x - blockViewX(s, n - 1);
    const ad = Math.abs(d);
    const dir = d > 0 ? 1 : -1;
    if (ad >= BLOCK) {
      // hiç değmedi, yanından düşüp gider
      loseLife(s);
      s.phase = 'falling';
      s.events.push({ type: 'miss', livesLeft: s.lives, x, y: cur.y, tipped: false });
      return;
    }
    if (ad > HALF) {
      // ağırlık merkezi kenarın dışında: kenardan devrilir
      loseLife(s);
      s.phase = 'falling';
      cur.vy = 0;
      cur.vx = dir * 70;
      cur.vr = dir * 150;
      s.events.push({ type: 'miss', livesLeft: s.lives, x, y: cur.y, tipped: true });
      return;
    }
    cx = s.blocks[n - 1].cx + d;
  }

  s.blocks.push({ level: n, cx, style: cur.style, lit: cur.lit });
  s.cur = null;

  // darbe: kaçıklık ve katın yatay momentumu kuleyi esnetir
  if (n > 0) s.wobV += d * WOBBLE_IMPULSE + cur.vx * 0.08;

  const a = Math.abs(d);
  let points: number;
  let grade: Grade;
  if (a <= PERFECT_TOL * diff.tol) {
    s.combo += 1;
    s.perfects += 1;
    points = SCORE.perfectBase + s.combo * SCORE.perfectPerCombo;
    grade = 'perfect';
    // tam oturan kat kuleyi sakinleştirir
    s.wob *= 0.7;
    s.wobV *= 0.5;
  } else if (a <= GOOD_TOL * diff.tol) {
    s.combo += 1;
    points = SCORE.goodBase + s.combo * SCORE.goodPerCombo;
    grade = 'good';
  } else {
    s.combo = 0;
    points = SCORE.ok;
    grade = 'ok';
  }
  s.score += points;
  if (s.combo > s.bestCombo) s.bestCombo = s.combo;
  s.events.push({ type: 'land', grade, combo: s.combo, points, x, y: cur.y });

  if (checkStability(s)) return;

  retargetCamera(s);
  spawn(s);
}

// Her kat için: üstündeki bölümün ağırlık merkezi bu katın üst yüzeyinin
// içinde mi? Değilse o bölüm kenar etrafında devrilir. En alttaki kopma noktası esas.
function checkStability(s: GameState): boolean {
  const b = s.blocks;
  const n = b.length;
  if (n < 2) return false;

  // sondan başa birikimli toplam: sum[j] = cx[j] + ... + cx[n-1]
  const sums = new Array<number>(n + 1).fill(0);
  for (let j = n - 1; j >= 0; j--) sums[j] = sums[j + 1] + b[j].cx;

  for (let j = 1; j < n; j++) {
    const com = sums[j] / (n - j);
    const off = com - b[j - 1].cx;
    if (Math.abs(off) > HALF) {
      topple(s, j, off > 0 ? 1 : -1);
      return true;
    }
  }
  return false;
}

function topple(s: GameState, from: number, dir: 1 | -1) {
  const sup = from - 1;
  const pivotX = blockViewX(s, sup) + dir * HALF;
  const pivotY = levelTop(sup) + s.camY;
  const blocks: ToppledBlock[] = [];
  for (let i = from; i < s.blocks.length; i++) {
    const bl = s.blocks[i];
    blocks.push({ x: blockViewX(s, i) - HALF, y: levelTop(i) + s.camY, style: bl.style, lit: bl.lit });
  }
  s.blocks.length = from;
  loseLife(s);
  s.wobV -= dir * 30; // kopan yükün tepkisi
  s.cur = null;
  s.phase = 'settling';
  s.waitT = RESPAWN_DELAY + 0.5;
  s.events.push({ type: 'topple', livesLeft: s.lives, dir, pivotX, pivotY, blocks });
}

/* ------------------------------ adım ------------------------------ */

export function step(s: GameState) {
  const dt = STEP;
  s.tick += 1;
  if (s.phase === 'over') return;

  // kule: sönümlü yay + rüzgâr. Yükseldikçe frekans düşer.
  const n = s.blocks.length;
  const w = 2 * Math.PI * (WOBBLE_FREQ / Math.sqrt(1 + n * 0.06));
  s.wobV += (-w * w * s.wob - 2 * WOBBLE_DAMP * w * s.wobV) * dt;
  s.wob += s.wobV * dt;
  s.windT += WIND_SPEED * dt;

  // kamera sadece kat havada değilken kayar, iniş noktası sabit kalsın
  if (s.phase === 'swinging' || s.phase === 'settling') {
    const k = Math.min(1, dt * CAMERA_LERP);
    s.camX += (s.camXTarget - s.camX) * k;
    s.camY += (s.camYTarget - s.camY) * k;
  }

  if (s.phase === 'settling') {
    s.waitT -= dt;
    if (s.waitT <= 0) afterLoss(s, 'collapse');
    return;
  }

  const cur = s.cur;
  if (!cur) return;

  if (s.phase === 'swinging') {
    // sarkaç: θ'' = -(g/L)·sin θ (yarı-örtük euler, enerji korunur)
    s.omega += -(GRAVITY / s.rope) * dsin(s.theta) * dt;
    s.theta += s.omega * dt;
    hangPosition(s, cur);
  } else if (s.phase === 'dropping') {
    cur.vy += GRAVITY * dt;
    cur.x += cur.vx * dt;
    cur.y += cur.vy * dt;
    const target = topSurface(s, s.camY) - BLOCK;
    if (cur.y >= target) {
      cur.y = target;
      land(s);
    }
  } else if (s.phase === 'falling') {
    cur.vy += GRAVITY * dt;
    cur.x += cur.vx * dt;
    cur.y += cur.vy * dt;
    cur.rot += cur.vr * dt;
    if (cur.y > VIEW_H + 200) afterLoss(s, 'lives');
  }
}

// Şu an bırakılsa kat, alttakinin merkezine göre nereye iner? step() ile birebir
// aynı hesabı yerel değişkenlerle yapar. Vitrin botu ve testler kullanır.
export function predictOffset(s: GameState): number | null {
  if (s.phase !== 'swinging' || !s.cur) return null;
  const dt = STEP;
  const n = s.blocks.length;
  const w = 2 * Math.PI * (WOBBLE_FREQ / Math.sqrt(1 + n * 0.06));
  let { x, y, vx, vy } = s.cur;
  let wob = s.wob;
  let wobV = s.wobV;
  let windT = s.windT;
  const target = topSurface(s, s.camY) - BLOCK;
  for (let i = 0; i < 1200; i++) {
    wobV += (-w * w * wob - 2 * WOBBLE_DAMP * w * wobV) * dt;
    wob += wobV * dt;
    windT += WIND_SPEED * dt;
    vy += GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;
    if (y >= target) break;
  }
  if (n === 0) return x + HALF - s.camX - VIEW_W / 2;
  const sway = (wob + windAmp(s) * dsin(windT)) * leanFactor(n - 1);
  return x + HALF - (s.blocks[n - 1].cx + s.camX + sway);
}

// ip ucu (renderer için), sadece vinçteyken
export function ropeEnd(s: GameState) {
  if (!s.cur || s.phase !== 'swinging') return null;
  return { x: s.cur.x + HALF, y: s.cur.y };
}
