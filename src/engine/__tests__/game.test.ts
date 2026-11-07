import { describe, expect, it } from 'vitest';
import {
  BLOCK,
  LIVES_MAX,
  MAX_CONTINUES,
  STEP,
  canContinue,
  continueRun,
  createGame,
  dsin,
  drop,
  nextRandom,
  predictOffset,
  seedFromString,
  simulate,
  step,
  toRecord,
  verify,
  type GameEvent,
  type GameState,
} from '../index';

// tahmini iniş kaçıklığı koşulu sağlayınca bırak, sonra sonucu bekle
function dropWhen(s: GameState, ok: (d: number) => boolean, maxTicks = 120 * 30): boolean {
  let dropped = false;
  for (let i = 0; i < maxTicks; i++) {
    const d = predictOffset(s);
    if (d !== null && ok(d)) {
      dropped = drop(s);
      break;
    }
    step(s);
  }
  for (let i = 0; i < 120 * 5 && s.phase !== 'swinging' && s.phase !== 'over'; i++) step(s);
  return dropped;
}

const perfect = (s: GameState) => expect(dropWhen(s, (d) => Math.abs(d) < 1)).toBe(true);
const events = (s: GameState) => s.events.splice(0);

describe('math', () => {
  it('dsin Math.sin ile uyumlu', () => {
    for (let x = -50; x < 50; x += 0.0137) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-8);
    }
  });

  it('rng aynı seedle aynı diziyi üretir', () => {
    const a = { rng: 42 };
    const b = { rng: 42 };
    for (let i = 0; i < 100; i++) expect(nextRandom(a)).toBe(nextRandom(b));
    expect(seedFromString('2026-11-06')).toBe(seedFromString('2026-11-06'));
    expect(seedFromString('2026-11-06')).not.toBe(seedFromString('2026-11-07'));
  });
});

describe('fizik', () => {
  it('sarkaç enerjiyi korur, genlik sabit kalır', () => {
    const s = createGame(1, 'normal');
    const theta0 = Math.abs(s.theta);
    let max = 0;
    for (let i = 0; i < 120 * 20; i++) {
      step(s);
      max = Math.max(max, Math.abs(s.theta));
    }
    expect(Math.abs(max - theta0)).toBeLessThan(theta0 * 0.01);
  });

  it('ip uzadıkça sarkaç yavaşlar (periyot ~ 2π√(L/g))', () => {
    const s = createGame(2, 'normal');
    // ilk kat: ip uzun
    const L = s.rope;
    let crossings = 0;
    let prev = s.theta;
    let ticks = 0;
    while (crossings < 2 && ticks < 120 * 30) {
      step(s);
      ticks++;
      if (Math.sign(s.theta) !== Math.sign(prev)) crossings++;
      prev = s.theta;
    }
    // iki sıfır geçişi arası yarım periyottan biraz fazlası; tam periyodu ölç
    const expected = 2 * Math.PI * Math.sqrt(L / 1250);
    expect(ticks * STEP).toBeGreaterThan(expected * 0.5);
    expect(ticks * STEP).toBeLessThan(expected * 0.85);
  });

  it('bırakılan kat salınım momentumunu korur', () => {
    const s = createGame(3, 'normal');
    // en hızlı an: dibe yakın
    while (Math.abs(s.theta) > 0.02) step(s);
    const vx = s.cur!.vx;
    expect(Math.abs(vx)).toBeGreaterThan(50);
    drop(s);
    const x0 = s.cur!.x;
    for (let i = 0; i < 12; i++) step(s);
    expect(Math.sign(s.cur!.x - x0)).toBe(Math.sign(vx));
  });

  it('kusursuz bırakışlar düz bir kule ve kombo yapar', () => {
    const s = createGame(4, 'normal');
    for (let i = 0; i < 12; i++) perfect(s);
    expect(s.blocks.length).toBe(12);
    expect(s.combo).toBe(12);
    expect(s.perfects).toBe(12);
    // katlar birbirinin tam üstünde
    for (let i = 1; i < 12; i++) expect(Math.abs(s.blocks[i].cx - s.blocks[i - 1].cx)).toBeLessThan(1.5);
  });

  it('ağırlık merkezi kenarı aşan kat devrilir ve hak götürür', () => {
    const s = createGame(5, 'hard');
    perfect(s);
    perfect(s);
    events(s);
    expect(dropWhen(s, (d) => Math.abs(d) > BLOCK / 2 + 4 && Math.abs(d) < BLOCK - 6)).toBe(true);
    const ev = events(s);
    const miss = ev.find((e) => e.type === 'miss') as Extract<GameEvent, { type: 'miss' }>;
    expect(miss).toBeTruthy();
    expect(miss.tipped).toBe(true);
    expect(s.lives).toBe(LIVES_MAX - 1);
    expect(s.blocks.length).toBe(2);
  });

  it('merdiven gibi kayan kule, ağırlık merkezi desteği aşınca devrilir', () => {
    const s = createGame(6, 'hard');
    perfect(s);
    events(s);
    let toppled: Extract<GameEvent, { type: 'topple' }> | undefined;
    for (let g = 0; g < 6 && !toppled; g++) {
      expect(dropWhen(s, (d) => d > 22 && d < 28)).toBe(true);
      toppled = events(s).find((e) => e.type === 'topple') as typeof toppled;
    }
    expect(toppled).toBeTruthy();
    expect(toppled!.blocks.length).toBeGreaterThanOrEqual(2);
    expect(s.lives).toBe(LIVES_MAX - 1);
    // kalan kule dengede
    for (let i = 1; i < s.blocks.length; i++) {
      expect(Math.abs(s.blocks[i].cx - s.blocks[i - 1].cx)).toBeLessThanOrEqual(BLOCK / 2);
    }
  });

  it('üç kayıp oyunu bitirir', () => {
    const s = createGame(7, 'hard');
    perfect(s);
    for (let i = 0; i < LIVES_MAX; i++) expect(dropWhen(s, (d) => Math.abs(d) >= BLOCK + 2)).toBe(true);
    expect(s.phase).toBe('over');
    expect(s.overReason).toBe('lives');
  });

  it('devam hakkı sınırlı', () => {
    const s = createGame(9, 'hard');
    perfect(s);
    for (let c = 0; c <= MAX_CONTINUES; c++) {
      for (let g = 0; g < 5 && s.phase !== 'over'; g++) dropWhen(s, (d) => Math.abs(d) >= BLOCK + 2);
      expect(s.phase).toBe('over');
      if (c < MAX_CONTINUES) expect(continueRun(s)).toBe(true);
    }
    expect(canContinue(s)).toBe(false);
    expect(continueRun(s)).toBe(false);
  });

  it('salınımda değilken bırakma yok sayılır', () => {
    const s = createGame(5, 'easy');
    expect(drop(s)).toBe(true);
    expect(drop(s)).toBe(false);
    expect(s.inputs.length).toBe(1);
  });
});

describe('replay', () => {
  function playRandom(seed: number) {
    const s = createGame(seed, 'hard');
    const r = { rng: seed * 31 };
    for (let guard = 0; guard < 400; guard++) {
      if (s.phase === 'over') {
        if (canContinue(s) && nextRandom(r) > 0.5) continueRun(s);
        else break;
      }
      const sloppy = nextRandom(r) < 0.5;
      const tol = sloppy ? 15 + nextRandom(r) * 60 : nextRandom(r) * 10;
      dropWhen(s, (d) => (sloppy ? Math.abs(d) > tol : Math.abs(d) < tol) || nextRandom(r) < 0.003);
    }
    return s;
  }

  it('kayıt baştan oynatılınca aynı skoru verir', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const s = playRandom(seed);
      expect(s.phase).toBe('over');
      const rec = toRecord(s);
      expect(verify(rec)).toBe(true);
      expect(simulate(rec.seed, rec.difficulty, rec.inputs).score).toBe(s.score);
    }
  });

  it('oynanmış skor reddedilir', () => {
    const rec = toRecord(playRandom(4));
    expect(verify({ ...rec, score: rec.score + 100 })).toBe(false);
    expect(verify({ ...rec, floors: rec.floors + 1 })).toBe(false);
    if (rec.inputs.length > 1) expect(verify({ ...rec, inputs: rec.inputs.slice().reverse() })).toBe(false);
  });
});
