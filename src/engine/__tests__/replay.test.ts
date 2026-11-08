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

  it('kayit girdileri kopyalar', () => {
    const s = play(12);
    const r = toRecord(s);
    expect(r.inputs).not.toBe(s.inputs);
    expect(r.inputs).toEqual(s.inputs);
  });

  it('kayit kat sayisini ve puani tasir', () => {
    const s = play(13);
    const r = toRecord(s);
    expect(r.floors).toBe(s.blocks.length);
    expect(r.score).toBe(s.score);
  });

  it('sisirilmis puan reddedilir', () => {
    const r = toRecord(play(14));
    expect(verify({ ...r, score: r.score + 1 })).toBe(false);
  });

  it('sisirilmis kat reddedilir', () => {
    const r = toRecord(play(15));
    expect(verify({ ...r, floors: r.floors + 1 })).toBe(false);
  });

  it('baska zorlukta kayit tutmaz', () => {
    const r = toRecord(play(30));
    expect(r.floors).toBeGreaterThan(0);
    expect(verify({ ...r, difficulty: 'hard' })).toBe(false);
  });

  it('sirasi bozuk girdiler reddedilir', () => {
    const r = toRecord(play(17));
    expect(verify({ ...r, inputs: [{ tick: 9, kind: 'drop' }, { tick: 2, kind: 'drop' }] })).toBe(false);
  });

  it('eski surum kayit dogrulanmaz', () => {
    const r = toRecord(play(18));
    expect(verify({ ...r, v: 1 } as unknown as typeof r)).toBe(false);
  });

  it('simulate ayni girdilerle ayni sonucu verir', () => {
    const s = play(19);
    const a = simulate(s.seed, s.difficulty, s.inputs, s.weather);
    const b = simulate(s.seed, s.difficulty, s.inputs, s.weather);
    expect(a.score).toBe(b.score);
    expect(a.tick).toBe(b.tick);
  });

  it('simulate adim sinirinda durur', () => {
    const s = simulate(1, 'normal', [], 'clear', 50);
    expect(s.tick).toBe(50);
  });

  it('simulate olaylari temizler', () => {
    const s = play(20);
    expect(simulate(s.seed, s.difficulty, s.inputs, s.weather).events).toHaveLength(0);
  });

  it('hayalet rekor kosusunu birebir tekrarlar', () => {
    const s = play(21);
    const g = makeGhost(toRecord(s));
    while (g.s.tick < s.tick) stepGhost(g);
    expect(g.s.score).toBe(s.score);
    expect(g.s.blocks.length).toBe(s.blocks.length);
  });

  it('hayalet olay biriktirmez', () => {
    const g = makeGhost(toRecord(play(22)));
    for (let i = 0; i < 500; i++) stepGhost(g);
    expect(g.s.events).toHaveLength(0);
  });
});
