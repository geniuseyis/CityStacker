import { describe, expect, it } from 'vitest';
import {
  BLOCK,
  LIVES_MAX,
  MAX_CONTINUES,
  VIEW_W,
  canContinue,
  continueRun,
  createGame,
  dsin,
  drop,
  nextRandom,
  seedFromString,
  simulate,
  step,
  toRecord,
  verify,
  type GameState,
} from '../index';

const targetCx = (s: GameState) => (s.blocks.length ? s.blocks[s.blocks.length - 1].cx : VIEW_W / 2);
const hangCx = (s: GameState) => s.cur!.x + BLOCK / 2 - s.camX;

// blok hedefle hizalanınca bırak; düşerken x değişmediği için iniş noktası bu olur
function dropWhen(s: GameState, ok: (d: number) => boolean, maxTicks = 120 * 20): boolean {
  let dropped = false;
  for (let i = 0; i < maxTicks; i++) {
    if (s.phase === 'swinging' && s.cur && ok(hangCx(s) - targetCx(s))) {
      dropped = drop(s);
      break;
    }
    step(s);
  }
  // inişi / düşüşü bekle
  for (let i = 0; i < 120 * 3 && (s.phase === 'dropping' || s.phase === 'falling'); i++) step(s);
  return dropped;
}

// sarkaç genliği normalde ıskaya yetmez, zor modda yeter
const miss = (s: GameState) => expect(dropWhen(s, (d) => Math.abs(d) >= BLOCK + 1)).toBe(true);
const perfect = (s: GameState) => expect(dropWhen(s, (d) => Math.abs(d) < 1.5)).toBe(true);

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

describe('oynanış', () => {
  it('hizalı bırakışlar kombo ve puan üretir', () => {
    const s = createGame(1, 'normal');
    for (let i = 0; i < 12; i++) perfect(s);
    expect(s.blocks.length).toBe(12);
    expect(s.combo).toBe(12);
    expect(s.perfects).toBe(12);
    expect(s.phase).toBe('swinging');
    let expected = 0;
    for (let k = 1; k <= 12; k++) expected += 100 + k * 25;
    expect(s.score).toBe(expected);
  });

  it('üç ıska oyunu bitirir', () => {
    const s = createGame(7, 'hard');
    perfect(s);
    for (let i = 0; i < LIVES_MAX; i++) miss(s);
    expect(s.phase).toBe('over');
    expect(s.overReason).toBe('lives');
    expect(s.blocks.length).toBe(1);
  });

  it('kayma sınırı aşılınca kule yıkılır, devam blok söker', () => {
    const s = createGame(3, 'hard');
    for (let g = 0; g < 40 && s.phase !== 'over'; g++) {
      expect(dropWhen(s, (d) => d > 40 && d < BLOCK - 4)).toBe(true);
    }
    expect(s.phase).toBe('over');
    expect(s.overReason).toBe('collapse');
    const before = s.blocks.length;
    expect(continueRun(s)).toBe(true);
    expect(s.phase).toBe('swinging');
    expect(s.blocks.length).toBeLessThan(before);
    expect(s.combo).toBe(0);
  });

  it('devam hakkı sınırlı', () => {
    const s = createGame(9, 'hard');
    perfect(s);
    for (let c = 0; c <= MAX_CONTINUES; c++) {
      for (let g = 0; g < 5 && s.phase !== 'over'; g++) miss(s);
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
    for (let guard = 0; guard < 2000; guard++) {
      if (s.phase === 'over') {
        if (canContinue(s) && nextRandom(r) > 0.5) continueRun(s);
        else break;
      }
      // çoğunlukla dikkatsiz bırakış, arada iyi hamle
      const sloppy = nextRandom(r) < 0.6;
      const tol = sloppy ? 20 + nextRandom(r) * 60 : nextRandom(r) * 10;
      dropWhen(s, (d) => (sloppy ? Math.abs(d) > tol : Math.abs(d) < tol) || nextRandom(r) < 0.004);
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
