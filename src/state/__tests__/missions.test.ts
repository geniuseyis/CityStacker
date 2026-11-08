import { describe, expect, it } from 'vitest';
import { advance, missionsFor, type Mission, type RunStats } from '../missions';

const run = (over: Partial<RunStats> = {}): RunStats => ({
  floors: 0,
  score: 0,
  perfects: 0,
  perfectStreak: 0,
  daily: false,
  weather: 'clear',
  ghostBeaten: false,
  ...over,
});
const m = (kind: Mission['kind']): Mission => ({ id: kind, kind, target: 1, reward: 1 });

describe('gorevler', () => {
  it('her gun 3 gorev cikar', () => {
    expect(missionsFor('2026-11-08')).toHaveLength(3);
  });

  it('ayni gun ayni gorevler', () => {
    expect(missionsFor('2026-11-08')).toEqual(missionsFor('2026-11-08'));
  });
});
