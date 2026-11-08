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
});
