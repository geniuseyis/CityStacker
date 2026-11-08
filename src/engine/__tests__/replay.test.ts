import { describe, expect, it } from 'vitest';
import { createGame, drop, makeGhost, predictOffset, simulate, step, stepGhost, toRecord, verify, type GameState } from '../index';

// once birkac kati duzgun koyar, sonra sabit aralikla birakip kaybeder
function play(seed: number): GameState {
  const s = createGame(seed, 'normal', { weather: 'clear' });
  for (let i = 0; i < 120 * 60 * 5 && s.phase !== 'over'; i++) {
    const d = predictOffset(s);
    if (s.blocks.length < 6 ? d !== null && Math.abs(d) < 4 : i % 233 === 0) drop(s);
    step(s);
  }
  return s;
}

describe('replay', () => {
  it('biten oyunun kaydi dogrulanir', () => {
    const s = play(11);
    expect(s.phase).toBe('over');
    expect(verify(toRecord(s))).toBe(true);
  });
});
