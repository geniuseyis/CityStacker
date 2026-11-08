import { describe, expect, it } from 'vitest';
import {
  BLOCK,
  COMBO_TIME,
  LIVES_MAX,
  MAX_CONTINUES,
  PERFECT_TOL,
  STEP,
  canContinue,
  continueCost,
  continueRun,
  createGame,
  dsin,
  drop,
  makeGhost,
  nextRandom,
  predictOffset,
  seedFromString,
  simulate,
  step,
  stepGhost,
  toRecord,
  verify,
  type GameEvent,
  type GameState,
} from '../index';
import { parseRecord } from '../../state/schema';

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

const CLEAR = { weather: 'clear' as const };
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

describe('denge', () => {
  it('hep aynı yöne kaçan mükemmel inişler kuleyi yıkmaz, kat tam oturur', () => {
    const s = createGame(21, 'normal', CLEAR);
    perfect(s);
    for (let i = 0; i < 20; i++) {
      expect(dropWhen(s, (d) => d > 3 && d < PERFECT_TOL - 1)).toBe(true);
    }
    expect(s.phase).not.toBe('over');
    expect(s.perfects).toBeGreaterThanOrEqual(20);
    expect(new Set(s.blocks.map((b) => b.cx)).size).toBe(1);
  });

  it('aynı yöne kaçan katlar kuleyi yıkmaz: her kat yalnızca alttakine bakar', () => {
    const s = createGame(22, 'normal', CLEAR);
    perfect(s);
    for (let i = 0; i < 12; i++) {
      expect(dropWhen(s, (d) => d > 19 && d < 30)).toBe(true);
      expect(s.phase).toBe('swinging');
    }
    expect(s.blocks.length).toBe(13);
    // kule gerçekten merdiven gibi kaydı
    expect(s.blocks[12].cx - s.blocks[0].cx).toBeGreaterThan(BLOCK * 2);
  });
});

describe('fizik', () => {
  it('sarkaç enerjiyi korur, genlik sabit kalır', () => {
    const s = createGame(1, 'normal', CLEAR);
    const theta0 = Math.abs(s.theta);
    let max = 0;
    for (let i = 0; i < 120 * 20; i++) {
      step(s);
      max = Math.max(max, Math.abs(s.theta));
    }
    expect(Math.abs(max - theta0)).toBeLessThan(theta0 * 0.01);
  });

  it('ip uzadıkça sarkaç yavaşlar (periyot ~ 2π√(L/g))', () => {
    const s = createGame(2, 'normal', CLEAR);
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
    const s = createGame(3, 'normal', CLEAR);
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
    const s = createGame(4, 'normal', CLEAR);
    for (let i = 0; i < 12; i++) perfect(s);
    expect(s.blocks.length).toBe(12);
    expect(s.combo).toBe(12);
    expect(s.perfects).toBe(12);
    // katlar birbirinin tam üstünde
    for (let i = 1; i < 12; i++) expect(Math.abs(s.blocks[i].cx - s.blocks[i - 1].cx)).toBeLessThan(1.5);
  });

  it('merkezi alttaki katın kenarını aşan kat devrilir ve hak götürür', () => {
    const s = createGame(5, 'hard', CLEAR);
    perfect(s);
    perfect(s);
    events(s);
    expect(dropWhen(s, (d) => Math.abs(d) > BLOCK / 2 + 4 && Math.abs(d) < BLOCK - 6)).toBe(true);
    const ev = events(s);
    const miss = ev.find((e) => e.type === 'miss') as Extract<GameEvent, { type: 'miss' }>;
    expect(miss).toBeTruthy();
    expect(miss.tipped).toBe(true);
    // düz kulede tepeden bir kat kopar, en az bir kat hep kalır
    expect(ev.some((e) => e.type === 'knock')).toBe(true);
    expect(s.blocks.length).toBe(1);
    // bir kalp gider, oyun sürer
    expect(s.lives).toBe(LIVES_MAX - 1);
    expect(s.phase).toBe('swinging');
  });

  it('tepe zaten kaçıksa kenardan düşen kat iki kat götürür', () => {
    const s = createGame(41, 'hard', CLEAR);
    perfect(s);
    perfect(s);
    perfect(s);
    expect(dropWhen(s, (d) => d > 20 && d < 30)).toBe(true);
    events(s);
    expect(s.blocks.length).toBe(4);
    expect(dropWhen(s, (d) => Math.abs(d) > BLOCK / 2 + 4 && Math.abs(d) < BLOCK - 6)).toBe(true);
    const knock = events(s).find((e) => e.type === 'knock') as Extract<GameEvent, { type: 'knock' }>;
    expect(knock.blocks.length).toBe(2);
    expect(s.blocks.length).toBe(2);
  });

  it('tek katlı kulede kenardan düşen kat alttakine dokunmaz', () => {
    const s = createGame(42, 'hard', CLEAR);
    perfect(s);
    events(s);
    expect(dropWhen(s, (d) => Math.abs(d) > BLOCK / 2 + 2)).toBe(true);
    expect(events(s).some((e) => e.type === 'knock')).toBe(false);
    expect(s.blocks.length).toBe(1);
  });

  it('kalpler bitince oyun durur, alınan hak kaldığı yerden sürdürür', () => {
    const s = createGame(7, 'hard', CLEAR);
    // alçak kulede salınım katı tamamen ıskalatacak kadar geniş değil
    for (let i = 0; i < 16; i++) perfect(s);
    for (let left = LIVES_MAX - 1; left >= 0; left--) {
      expect(dropWhen(s, (d) => Math.abs(d) >= BLOCK + 2)).toBe(true);
      expect(s.lives).toBe(left);
    }
    expect(s.phase).toBe('over');
    expect(s.overReason).toBe('miss');
    expect(continueCost(s)).toBe(1);
    expect(continueRun(s)).toBe(true);
    expect(s.phase).toBe('swinging');
    // jetonla devam tek kalp verir
    expect(s.lives).toBe(1);
    expect(s.blocks.length).toBe(16);
    expect(continueCost(s)).toBe(2);
  });

  it('devam hakkı sınırlı', () => {
    const s = createGame(9, 'hard', CLEAR);
    // alçak kulede salınım katı tamamen ıskalatacak kadar geniş değil
    for (let i = 0; i < 16; i++) perfect(s);
    for (let c = 0; c <= MAX_CONTINUES; c++) {
      for (let g = 0; g < 5 && s.phase !== 'over'; g++) dropWhen(s, (d) => Math.abs(d) >= BLOCK + 2);
      expect(s.phase).toBe('over');
      if (c < MAX_CONTINUES) expect(continueRun(s)).toBe(true);
    }
    expect(canContinue(s)).toBe(false);
    expect(continueRun(s)).toBe(false);
  });

  it('kombo sayacı dolar, süre bitince kombo sıfırlanır', () => {
    const s = createGame(31, 'normal', CLEAR);
    perfect(s);
    perfect(s);
    expect(s.combo).toBe(2);
    expect(s.comboT).toBeGreaterThan(COMBO_TIME - 1);
    for (let i = 0; i < 120 * (COMBO_TIME + 1); i++) step(s);
    expect(s.comboT).toBe(0);
    expect(s.combo).toBe(0);
  });

  it('hızlı yerleşen kat daha çok puan alır', () => {
    const landPoints = (wait: number) => {
      const s = createGame(32, 'normal', CLEAR);
      for (let i = 0; i < wait; i++) step(s);
      perfect(s);
      return (s.events.find((e) => e.type === 'land') as Extract<GameEvent, { type: 'land' }>).points;
    };
    expect(landPoints(0)).toBeGreaterThan(landPoints(120 * 6));
  });

  it('rüzgâr düşen katı esme yönüne iter', () => {
    const clear = createGame(12, 'normal', CLEAR);
    const windy = createGame(12, 'normal', { weather: 'windy' });
    // ikisinde de aynı anda bırak
    for (let i = 0; i < 90; i++) {
      step(clear);
      step(windy);
    }
    drop(clear);
    drop(windy);
    // iniş ~40 adım sürer, ondan önce bak
    for (let i = 0; i < 20; i++) {
      step(clear);
      step(windy);
    }
    expect(windy.phase).toBe('dropping');
    const dx = windy.cur!.x - clear.cur!.x;
    expect(Math.sign(dx)).toBe(windy.windDir);
  });

  it('salınımda değilken bırakma yok sayılır', () => {
    const s = createGame(5, 'easy', CLEAR);
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

  it('her hava olayında (fırtına dahil) kayıt aynı skoru verir', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 400 && seen.size < 4; seed++) {
      const g = createGame(seed, 'hard');
      if (seen.has(g.weather)) continue;
      seen.add(g.weather);
      const s = playRandom(seed);
      expect(s.weather).toBe(g.weather);
      expect(verify(toRecord(s))).toBe(true);
    }
    expect(seen.size).toBe(4);
  });

  it('oynanmış skor reddedilir', () => {
    const rec = toRecord(playRandom(4));
    expect(verify({ ...rec, score: rec.score + 100 })).toBe(false);
    expect(verify({ ...rec, floors: rec.floors + 1 })).toBe(false);
    if (rec.inputs.length > 1) expect(verify({ ...rec, inputs: rec.inputs.slice().reverse() })).toBe(false);
  });
});

describe('hayalet', () => {
  it('kayıt oyuncuyla aynı adımda oynatılınca rekorun aynısına ulaşır', () => {
    // devam haklarını da içeren rastgele bir koşu
    const s = createGame(77, 'normal');
    const r = { rng: 991 };
    for (let guard = 0; guard < 400; guard++) {
      if (s.phase === 'over') {
        if (canContinue(s) && nextRandom(r) > 0.4) continueRun(s);
        else break;
      }
      const tol = nextRandom(r) < 0.5 ? 40 + nextRandom(r) * 40 : nextRandom(r) * 8;
      dropWhen(s, (d) => Math.abs(d) < tol || nextRandom(r) < 0.004);
    }
    expect(s.phase).toBe('over');
    const rec = toRecord(s);

    // oyuncu kendi oyununu oynarken hayalet her adımda bir adım ilerler
    const player = createGame(rec.seed, rec.difficulty, { weather: rec.weather });
    const g = makeGhost(rec);
    let floors = 0;
    for (let k = 0; k < s.tick + 10; k++) {
      step(player);
      stepGhost(g);
      floors = Math.max(floors, g.s.blocks.length);
    }
    expect(g.s.phase).toBe('over');
    expect(g.s.score).toBe(rec.score);
    expect(g.s.blocks.length).toBe(rec.floors);
    expect(floors).toBeGreaterThanOrEqual(rec.floors);
  });

  it('diskten gelen bozuk kayıt reddedilir', () => {
    const rec = toRecord(createGame(5, 'easy'));
    expect(parseRecord(JSON.parse(JSON.stringify(rec)))).toEqual(rec);
    expect(parseRecord({ ...rec, weather: 'tornado' })).toBeNull();
    expect(
      parseRecord({
        ...rec,
        inputs: [
          { tick: 5, kind: 'drop' },
          { tick: 2, kind: 'drop' },
        ],
      })
    ).toBeNull();
    expect(parseRecord({ ...rec, inputs: [{ tick: 1, kind: 'jump' }] })).toBeNull();
    expect(parseRecord('çöp')).toBeNull();
  });
});
