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
});
