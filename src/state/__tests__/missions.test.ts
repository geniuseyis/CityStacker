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

  it('farkli gunlerde gorevler degisir', () => {
    const days = Array.from({ length: 10 }, (_, i) => JSON.stringify(missionsFor(`2026-11-0${i}`)));
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it('bir gunde ayni tur iki kez gelmez', () => {
    for (let d = 10; d < 30; d++) {
      const kinds = missionsFor(`2026-11-${d}`).map((x) => x.kind);
      expect(new Set(kinds).size).toBe(3);
    }
  });

  it('kimlik tur ve hedeften olusur', () => {
    for (const x of missionsFor('2026-12-01')) expect(x.id).toBe(`${x.kind}.${x.target}`);
  });

  it('hedef ve odul pozitif', () => {
    for (const x of missionsFor('2026-12-02')) {
      expect(x.target).toBeGreaterThan(0);
      expect(x.reward).toBeGreaterThan(0);
    }
  });

  it('art arda mukemmel en iyiyi tutar', () => {
    expect(advance(m('perfectStreak'), 4, run({ perfectStreak: 2 }))).toBe(4);
    expect(advance(m('perfectStreak'), 4, run({ perfectStreak: 6 }))).toBe(6);
  });

  it('kat gorevi tek oyunun en iyisini tutar', () => {
    expect(advance(m('floorsRun'), 12, run({ floors: 5 }))).toBe(12);
  });
});
