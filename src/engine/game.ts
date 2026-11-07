import {
  AMP_BASE,
  AMP_MAX,
  AMP_STEP,
  BLOCK,
  BLOCK_STYLES,
  CAMERA_LERP,
  COMBO_DOWN_RATE,
  COMBO_MAX,
  COMBO_SPEED_STEP,
  COMBO_UP_RATE,
  DESIRED_TOP_Y,
  DIFFICULTY,
  DROP_V0,
  GOOD_TOL,
  GRAVITY,
  GROUND_Y,
  LIVES_MAX,
  MAX_CONTINUES,
  MAX_DRIFT,
  MISS_DRIFT_X,
  PERFECT_TOL,
  PIVOT_Y,
  ROPE_LEN,
  SCORE,
  SPEED_BASE,
  SPEED_HARD_CAP,
  SPEED_MAX,
  SPEED_STEP,
  STEP,
  SWAY_SPEED,
  TILT_MAX,
  TILT_PER_OFFSET,
  VIEW_H,
  VIEW_W,
} from './constants';
import { clamp, dcos, dsin, nextRandom } from './math';
import type { Difficulty, GameState, Hanging } from './types';

export function createGame(seed: number, difficulty: Difficulty): GameState {
  const s: GameState = {
    seed: seed >>> 0,
    rng: seed | 0,
    difficulty,
    tick: 0,
    phase: 'swinging',
    overReason: null,
    blocks: [],
    cur: null,
    swingT: 0,
    swayT: 0,
    fallV: 0,
    speedMul: 1,
    speedTarget: 1,
    camX: 0,
    camCenterX: 0,
    camCenterTarget: 0,
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
  s.swayT = nextRandom(s) * Math.PI * 2;
  s.cur = spawn(s);
  return s;
}

export const levelTop = (level: number) => GROUND_Y - (level + 1) * BLOCK;

// yükseldikçe kule biraz daha sallanır
export const swayAmpFor = (blocks: number) => Math.min(20, Math.max(0, blocks - 3) * 1.1);

function spawn(s: GameState): Hanging {
  let lit = 0;
  for (let i = 0; i < 6; i++) if (nextRandom(s) > 0.4) lit |= 1 << i;
  return {
    x: VIEW_W / 2 - BLOCK / 2,
    y: PIVOT_Y + ROPE_LEN,
    style: s.blocks.length % BLOCK_STYLES,
    lit,
  };
}

function swingSpeed(s: GameState) {
  const n = s.blocks.length;
  return Math.min(SPEED_MAX, (SPEED_BASE + n * SPEED_STEP) * DIFFICULTY[s.difficulty].speed);
}

function swingAmp(s: GameState) {
  const n = s.blocks.length;
  return Math.min(AMP_MAX, (AMP_BASE + n * AMP_STEP) * DIFFICULTY[s.difficulty].amp);
}

export function drop(s: GameState): boolean {
  if (s.phase !== 'swinging' || !s.cur) return false;
  s.inputs.push({ tick: s.tick, kind: 'drop' });
  s.phase = 'dropping';
  s.fallV = DROP_V0;
  s.events.push({ type: 'drop' });
  return true;
}

export const canContinue = (s: GameState) => s.phase === 'over' && s.continues < MAX_CONTINUES;

// jeton ya da ödüllü reklam sonrası: oyunu kaldığı yerden sürdür
export function continueRun(s: GameState): boolean {
  if (!canContinue(s)) return false;
  s.inputs.push({ tick: s.tick, kind: 'continue' });
  s.continues += 1;

  if (s.overReason === 'collapse') {
    // kayma güvenli seviyeye inene kadar tepeden blok sök
    const limit = MAX_DRIFT * DIFFICULTY[s.difficulty].drift * 0.5;
    while (s.blocks.length > 1 && Math.abs(s.blocks[s.blocks.length - 1].cx - s.blocks[0].cx) > limit) {
      s.blocks.pop();
    }
    retargetCamera(s);
  } else {
    s.lives = 1;
  }

  s.overReason = null;
  s.combo = 0;
  s.speedTarget = 1;
  s.fallV = 0;
  s.swingT = 0;
  s.cur = spawn(s);
  s.phase = 'swinging';
  s.events.push({ type: 'continue' });
  return true;
}

function retargetCamera(s: GameState) {
  const n = s.blocks.length;
  s.camCenterTarget = n ? VIEW_W / 2 - s.blocks[n - 1].cx : 0;
  const natural = GROUND_Y - n * BLOCK;
  s.camYTarget = Math.max(0, DESIRED_TOP_Y - natural);
}

function gameOver(s: GameState, reason: 'collapse' | 'lives') {
  s.phase = 'over';
  s.overReason = reason;
  s.events.push({ type: 'over', reason });
}

function land(s: GameState) {
  const cur = s.cur!;
  const diff = DIFFICULTY[s.difficulty];
  const cx = cur.x + BLOCK / 2 - s.camX;
  const screenX = cur.x + BLOCK / 2;
  const screenY = cur.y;
  const n = s.blocks.length;

  const offset = n === 0 ? cx - VIEW_W / 2 : cx - s.blocks[n - 1].cx;

  if (n > 0 && Math.abs(offset) >= BLOCK) {
    s.phase = 'falling';
    s.fallV = 0;
    s.combo = 0;
    s.speedTarget = 1;
    s.lives -= 1;
    s.events.push({ type: 'miss', livesLeft: s.lives, x: screenX, y: screenY });
    return;
  }

  const rot = clamp(offset * TILT_PER_OFFSET, -TILT_MAX, TILT_MAX);
  s.blocks.push({ level: n, cx, rot, style: cur.style, lit: cur.lit });
  s.cur = null;

  const a = Math.abs(offset);
  let points: number;
  let grade: 'perfect' | 'good' | 'ok';
  if (a <= PERFECT_TOL * diff.tol) {
    s.combo += 1;
    s.perfects += 1;
    points = SCORE.perfectBase + s.combo * SCORE.perfectPerCombo;
    grade = 'perfect';
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
  s.speedTarget = 1 + Math.min(s.combo, COMBO_MAX) * COMBO_SPEED_STEP;
  s.events.push({ type: 'land', grade, combo: s.combo, points, x: screenX, y: screenY });

  const drift = s.blocks[s.blocks.length - 1].cx - s.blocks[0].cx;
  if (Math.abs(drift) > MAX_DRIFT * diff.drift) {
    s.events.push({ type: 'collapse', x: screenX, y: screenY });
    gameOver(s, 'collapse');
    return;
  }

  retargetCamera(s);
  s.cur = spawn(s);
  s.swingT = 0;
  s.phase = 'swinging';
}

// tek sabit adım (STEP saniye)
export function step(s: GameState) {
  const dt = STEP;
  s.tick += 1;
  if (s.phase === 'over') return;

  // kamera ve kule sallanması sadece salınımda ilerler, bırakınca sahne donar
  if (s.phase === 'swinging') {
    const k = Math.min(1, dt * CAMERA_LERP);
    s.swayT += SWAY_SPEED * dt;
    s.camCenterX += (s.camCenterTarget - s.camCenterX) * k;
    s.camY += (s.camYTarget - s.camY) * k;
  }
  s.camX = s.camCenterX + swayAmpFor(s.blocks.length) * dsin(s.swayT);

  const cur = s.cur;
  if (!cur) return;

  if (s.phase === 'swinging') {
    const rate = s.speedTarget > s.speedMul ? COMBO_UP_RATE : COMBO_DOWN_RATE;
    s.speedMul += (s.speedTarget - s.speedMul) * Math.min(1, dt * rate);
    const speed = Math.min(SPEED_HARD_CAP, swingSpeed(s) * s.speedMul);
    s.swingT += speed * dt;
    const angle = swingAmp(s) * dsin(s.swingT);
    cur.x = VIEW_W / 2 + ROPE_LEN * dsin(angle) - BLOCK / 2;
    cur.y = PIVOT_Y + ROPE_LEN * dcos(angle);
  } else if (s.phase === 'dropping') {
    s.fallV += GRAVITY * dt;
    cur.y += s.fallV * dt;
    const target = GROUND_Y - s.blocks.length * BLOCK + s.camY - BLOCK;
    if (cur.y >= target) {
      cur.y = target;
      land(s);
    }
  } else if (s.phase === 'falling') {
    s.fallV += GRAVITY * dt;
    cur.y += s.fallV * dt;
    cur.x += MISS_DRIFT_X * dt;
    if (cur.y > VIEW_H + 120) {
      if (s.lives > 0) {
        s.cur = spawn(s);
        s.swingT = 0;
        s.fallV = 0;
        s.phase = 'swinging';
        s.events.push({ type: 'respawn' });
      } else {
        s.cur = null;
        gameOver(s, 'lives');
      }
    }
  }
}

// rope'un bağlı olduğu nokta (renderer için)
export function ropeEnd(s: GameState) {
  if (!s.cur || s.phase !== 'swinging') return null;
  return { x: s.cur.x + BLOCK / 2, y: s.cur.y };
}
