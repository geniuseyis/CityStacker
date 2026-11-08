import { describe, expect, it } from 'vitest';
import {
  BLOCK,
  DIFFICULTY,
  GROUND_Y,
  LIVES_MAX,
  MAX_CONTINUES,
  STEP,
  VIEW_H,
  VIEW_W,
  WEATHER,
  canContinue,
  continueCost,
  continueRun,
  createGame,
  drop,
  levelTop,
  ropeEnd,
  step,
} from '../index';

const over = () => {
  const s = createGame(3, 'normal', { weather: 'clear' });
  s.phase = 'over';
  return s;
};

describe('motor kurallari', () => {
  it('oyun tam hakla baslar', () => {
    expect(createGame(1, 'normal').lives).toBe(LIVES_MAX);
  });

  it('oyun bos kule ve sifir puanla baslar', () => {
    const s = createGame(1, 'normal');
    expect(s.blocks).toHaveLength(0);
    expect(s.score).toBe(0);
    expect(s.combo).toBe(0);
  });

  it('ayni seed ayni havayi verir', () => {
    expect(createGame(77, 'hard').weather).toBe(createGame(77, 'hard').weather);
  });

  it('secilen hava zorlanir', () => {
    expect(createGame(5, 'easy', { weather: 'fog' }).weather).toBe('fog');
  });

  it('adim sayaci her adimda artar', () => {
    const s = createGame(2, 'normal', { weather: 'clear' });
    step(s);
    step(s);
    expect(s.tick).toBe(2);
  });

  it('birakma girdiyi kaydeder', () => {
    const s = createGame(2, 'normal', { weather: 'clear' });
    for (let i = 0; i < 120 && s.phase !== 'swinging'; i++) step(s);
    expect(drop(s)).toBe(true);
    expect(s.inputs[0].kind).toBe('drop');
  });

  it('dusen kat tekrar birakilamaz', () => {
    const s = createGame(2, 'normal', { weather: 'clear' });
    for (let i = 0; i < 120 && s.phase !== 'swinging'; i++) step(s);
    drop(s);
    expect(drop(s)).toBe(false);
    expect(s.inputs).toHaveLength(1);
  });

  it('oyun bitince birakma calismaz', () => {
    expect(drop(over())).toBe(false);
  });

  it('devam ilk seferde 1 jeton', () => {
    expect(continueCost(over())).toBe(1);
  });

  it('devam ucreti her seferde artar', () => {
    const s = over();
    s.continues = 3;
    expect(continueCost(s)).toBe(4);
  });

  it('oyun bitmeden devam edilemez', () => {
    const s = createGame(3, 'normal', { weather: 'clear' });
    expect(canContinue(s)).toBe(false);
    expect(continueRun(s)).toBe(false);
  });

  it('devam sinirina gelince devam edilemez', () => {
    const s = over();
    s.continues = MAX_CONTINUES;
    expect(canContinue(s)).toBe(false);
  });

  it('devam bir hak verir ve komboyu sifirlar', () => {
    const s = over();
    s.combo = 6;
    expect(continueRun(s)).toBe(true);
    expect(s.lives).toBe(1);
    expect(s.combo).toBe(0);
    expect(s.continues).toBe(1);
  });

  it('devam girdisi kayda islenir', () => {
    const s = over();
    continueRun(s);
    expect(s.inputs.at(-1)?.kind).toBe('continue');
  });

  it('kat yuksekligi blok kadar artar', () => {
    expect(levelTop(0) - levelTop(1)).toBe(BLOCK);
    expect(levelTop(0)).toBe(GROUND_Y - BLOCK);
  });

  it('ip ucu ekran icinde baslar', () => {
    const s = createGame(4, 'normal', { weather: 'clear' });
    for (let i = 0; i < 240; i++) step(s);
    const e = ropeEnd(s)!;
    expect(e.x).toBeGreaterThan(0);
    expect(e.x).toBeLessThan(VIEW_W);
    expect(e.y).toBeLessThan(VIEW_H);
  });

  it('zorluk arttikca tolerans daralir', () => {
    expect(DIFFICULTY.easy.tol).toBeGreaterThan(DIFFICULTY.normal.tol);
    expect(DIFFICULTY.normal.tol).toBeGreaterThan(DIFFICULTY.hard.tol);
  });

  it('zorluk arttikca salinim hizlanir', () => {
    expect(DIFFICULTY.hard.swing).toBeGreaterThan(DIFFICULTY.easy.swing);
  });

  it('zor hava daha cok puan verir', () => {
    expect(WEATHER.storm.score).toBeGreaterThan(WEATHER.windy.score);
    expect(WEATHER.windy.score).toBeGreaterThan(WEATHER.clear.score);
  });
});
