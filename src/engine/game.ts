import {
  BLOCK,
  BLOCK_STYLES,
  CAMERA_LERP,
  COMBO_TIME,
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
  ROPE_MAX,
  ROPE_MIN,
  SCORE,
  SPEED_WINDOW,
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
  WEATHER,
} from './constants';
import { clamp, dcos, dsin, nextRandom } from './math';
import type { Difficulty, FallenBlock, GameState, Grade, Hanging, OverReason, Weather } from './types';

const HALF = BLOCK / 2;

// hava seed'den gelir: aynı seed her yerde aynı havayı verir (günlük kule, hayalet, replay)
function rollWeather(r: number): Weather {
  if (r < 0.6) return 'clear';
  if (r < 0.8) return 'windy';
  if (r < 0.92) return 'fog';
  return 'storm';
}

export function createGame(seed: number, difficulty: Difficulty, opts: { weather?: Weather } = {}): GameState {
  const s: GameState = {
    seed: seed >>> 0,
    rng: seed | 0,
    difficulty,
    tick: 0,
    phase: 'swinging',
    overReason: null,
    lastLoss: null,
    blocks: [],
    cur: null,
    rope: ROPE_MAX,
    theta: 0,
    omega: 0,
    side: 1,
    weather: 'clear',
    windDir: 1,
    gust: 0,
    gustT: 0,
    wob: 0,
    wobV: 0,
    windT: 0,
    camX: 0,
    camXTarget: 0,
    camY: 0,
    camYTarget: 0,
    score: 0,
    combo: 0,
    comboT: 0,
    spawnTick: 0,
    bestCombo: 0,
    perfects: 0,
    lives: LIVES_MAX,
    continues: 0,
    inputs: [],
    events: [],
  };
  s.windT = nextRandom(s) * Math.PI * 2;
  s.side = nextRandom(s) < 0.5 ? 1 : -1;
  const w = rollWeather(nextRandom(s));
  s.weather = opts.weather ?? w;
  s.windDir = nextRandom(s) < 0.5 ? 1 : -1;
  s.gustT = 3 + nextRandom(s) * 4;
  spawn(s);
  return s;
}

export const levelTop = (level: number) => GROUND_Y - (level + 1) * BLOCK;

/* ------------------------------ kule ------------------------------ */

// rüzgârın tepe noktasında yaptığı salınım; kule kısayken hiç yok
const windAmp = (s: GameState) => {
  const w = WEATHER[s.weather];
  return Math.min(10, Math.max(0, s.blocks.length - w.windFrom) * 0.6) * w.wind * DIFFICULTY[s.difficulty].wind;
};

// kata etki eden toplam yan kuvvet (ivme): sabit rüzgâr + fırtına esintisi
const sidePush = (s: GameState) => WEATHER[s.weather].push * s.windDir + s.gust;

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
  s.spawnTick = s.tick;
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

// bir sonraki hakkın jeton fiyatı
export const continueCost = (s: GameState) => s.continues + 1;

// jeton ya da ödüllü reklam sonrası: bir hakla kaldığı yerden sürdür
export function continueRun(s: GameState): boolean {
  if (!canContinue(s)) return false;
  s.inputs.push({ tick: s.tick, kind: 'continue' });
  s.continues += 1;
  s.lives = 1;
  s.overReason = null;
  s.lastLoss = null;
  s.combo = 0;
  s.comboT = 0;
  s.wob = 0;
  s.wobV = 0;
  retargetCamera(s);
  spawn(s);
  s.events.push({ type: 'continue' });
  return true;
}

/* ------------------------------ iniş ------------------------------ */

function loseLife(s: GameState, reason: OverReason) {
  s.lastLoss = reason;
  s.lives -= 1;
  s.combo = 0;
  s.comboT = 0;
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

// Kenardan düşen kat tepeden kat koparır: tepe zaten kaçıksa iki, düzse bir kat.
// En alttaki kat her zaman yerinde kalır.
function knockFloors(s: GameState, dir: 1 | -1) {
  const n = s.blocks.length;
  if (n < 2) return;
  const wayward = Math.abs(s.blocks[n - 1].cx - s.blocks[n - 2].cx) > GOOD_TOL * DIFFICULTY[s.difficulty].tol;
  const count = Math.min(wayward ? 2 : 1, n - 1);
  const blocks: FallenBlock[] = [];
  for (let i = n - count; i < n; i++) {
    const b = s.blocks[i];
    blocks.push({ x: blockViewX(s, i) - HALF, y: levelTop(i) + s.camY, style: b.style, lit: b.lit });
  }
  s.blocks.length = n - count;
  s.wobV -= dir * 30; // kopan katların tepkisi
  s.events.push({ type: 'knock', dir, blocks });
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
      loseLife(s, 'miss');
      s.phase = 'falling';
      s.events.push({ type: 'miss', livesLeft: s.lives, x, y: cur.y, tipped: false });
      return;
    }
    if (ad > HALF) {
      // ağırlık merkezi kenarın dışında: kenardan devrilir
      loseLife(s, 'tipped');
      s.phase = 'falling';
      cur.vy = 0;
      cur.vx = dir * 70;
      cur.vr = dir * 150;
      s.events.push({ type: 'miss', livesLeft: s.lives, x, y: cur.y, tipped: true });
      knockFloors(s, dir);
      return;
    }
    // mükemmel iniş tam ortaya oturur
    if (ad <= PERFECT_TOL * diff.tol) d = 0;
    cx = s.blocks[n - 1].cx + d;
  }

  const a = Math.abs(x - (n > 0 ? blockViewX(s, n - 1) : VIEW_W / 2 + s.camX));
  s.blocks.push({ level: n, cx, style: cur.style, lit: cur.lit });
  s.cur = null;

  // darbe: kaçıklık ve katın yatay momentumu kuleyi esnetir
  if (n > 0) s.wobV += d * WOBBLE_IMPULSE + cur.vx * 0.08;

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
  if (grade === 'ok') {
    s.comboT = 0;
  } else {
    s.comboT = COMBO_TIME;
    // hızlı ve isabetli yerleştirme: mükemmelde tam, iyide yarım
    const elapsed = (s.tick - s.spawnTick) * STEP;
    const speed = SCORE.speedMax * Math.max(0, 1 - elapsed / SPEED_WINDOW);
    points += grade === 'perfect' ? speed : speed / 2;
  }
  points = Math.round(points * WEATHER[s.weather].score);
  s.score += points;
  if (s.combo > s.bestCombo) s.bestCombo = s.combo;
  s.events.push({ type: 'land', grade, combo: s.combo, points, x, y: cur.y });

  retargetCamera(s);
  spawn(s);
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

  if (s.comboT > 0) {
    s.comboT -= dt;
    if (s.comboT <= 0) {
      s.comboT = 0;
      s.combo = 0;
    }
  }

  // fırtına: arada bir ani esinti, yavaşça söner; kuleyi de iter
  if (WEATHER[s.weather].gusts) {
    s.gustT -= dt;
    if (s.gustT <= 0) {
      s.gust += (nextRandom(s) < 0.5 ? -1 : 1) * (40 + nextRandom(s) * 50);
      s.gustT = 3 + nextRandom(s) * 4;
    }
  }
  if (s.gust !== 0) {
    s.wobV += s.gust * 0.5 * dt;
    s.gust *= 1 - Math.min(1, dt * 1.5);
    if (Math.abs(s.gust) < 0.05) s.gust = 0;
  }

  // kamera sadece kat havada değilken kayar, iniş noktası sabit kalsın
  if (s.phase === 'swinging') {
    const k = Math.min(1, dt * CAMERA_LERP);
    s.camX += (s.camXTarget - s.camX) * k;
    s.camY += (s.camYTarget - s.camY) * k;
  }

  const cur = s.cur;
  if (!cur) return;

  if (s.phase === 'swinging') {
    // sarkaç: θ'' = -(g/L)·sin θ (yarı-örtük euler, enerji korunur)
    // yan rüzgâr ipe dik bileşeniyle sarkacı iter: θ'' = (-g·sin θ + a·cos θ) / L
    s.omega += ((-GRAVITY * dsin(s.theta) + sidePush(s) * dcos(s.theta)) / s.rope) * dt;
    s.theta += s.omega * dt;
    hangPosition(s, cur);
  } else if (s.phase === 'dropping') {
    cur.vx += sidePush(s) * dt;
    cur.vy += GRAVITY * dt;
    cur.x += cur.vx * dt;
    cur.y += cur.vy * dt;
    const target = topSurface(s, s.camY) - BLOCK;
    if (cur.y >= target) {
      cur.y = target;
      land(s);
    }
  } else if (s.phase === 'falling') {
    cur.vx += sidePush(s) * dt;
    cur.vy += GRAVITY * dt;
    cur.x += cur.vx * dt;
    cur.y += cur.vy * dt;
    cur.rot += cur.vr * dt;
    if (cur.y > VIEW_H + 200) afterLoss(s, s.lastLoss ?? 'miss');
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
  let gust = s.gust;
  const push = WEATHER[s.weather].push * s.windDir;
  const target = topSurface(s, s.camY) - BLOCK;
  for (let i = 0; i < 1200; i++) {
    wobV += (-w * w * wob - 2 * WOBBLE_DAMP * w * wobV) * dt;
    wob += wobV * dt;
    windT += WIND_SPEED * dt;
    if (gust !== 0) {
      wobV += gust * 0.5 * dt;
      gust *= 1 - Math.min(1, dt * 1.5);
    }
    vx += (push + gust) * dt;
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
