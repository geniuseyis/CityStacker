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
});
