import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, MAX_RUNS, MAX_TOKENS, START_TOKENS, parseProgress } from '../schema';

describe('parseProgress', () => {
  it('bozuk kayit varsayilan ilerlemeye doner', () => {
    expect(parseProgress(undefined)).toEqual(DEFAULT_PROGRESS);
  });

  it('varsayilan listeleri paylasmaz', () => {
    const p = parseProgress(null);
    p.owned.push('skin.glass');
    p.best.easy = 9;
    expect(DEFAULT_PROGRESS.owned).toEqual([]);
    expect(DEFAULT_PROGRESS.best.easy).toBe(0);
  });

  it('jeton yoksa baslangic jetonu verilir', () => {
    expect(parseProgress({}).tokens).toBe(START_TOKENS);
  });

  it('negatif jeton sifirlanir', () => {
    expect(parseProgress({ tokens: -50 }).tokens).toBe(0);
  });

  it('jeton ust siniri asamaz', () => {
    expect(parseProgress({ tokens: 1e12 }).tokens).toBe(MAX_TOKENS);
  });

  it('kesirli jeton asagi yuvarlanir', () => {
    expect(parseProgress({ tokens: 7.9 }).tokens).toBe(7);
  });

  it('sonsuz jeton kabul edilmez', () => {
    expect(parseProgress({ tokens: Infinity }).tokens).toBe(START_TOKENS);
    expect(parseProgress({ tokens: NaN }).tokens).toBe(START_TOKENS);
  });

  it('metin olarak gelen jeton reddedilir', () => {
    expect(parseProgress({ tokens: '9999' }).tokens).toBe(START_TOKENS);
  });

  it('rekorlar zorluga gore okunur', () => {
    expect(parseProgress({ best: { easy: 10, normal: 20, hard: 30 } }).best).toEqual({ easy: 10, normal: 20, hard: 30 });
  });

  it('eksik rekor sifir sayilir', () => {
    expect(parseProgress({ best: { hard: 5 } }).best).toEqual({ easy: 0, normal: 0, hard: 5 });
  });

  it('liste olmayan oyun gecmisi bosalir', () => {
    expect(parseProgress({ runs: 'x' }).runs).toEqual([]);
  });

  it('oyun gecmisi sinirla kesilir', () => {
    const runs = Array.from({ length: MAX_RUNS + 10 }, (_, i) => ({ score: i }));
    expect(parseProgress({ runs }).runs).toHaveLength(MAX_RUNS);
  });

  it('gecmiste nesne olmayan satirlar atilir', () => {
    expect(parseProgress({ runs: [1, null, { score: 5 }] }).runs).toHaveLength(1);
  });

  it('gecmiste bilinmeyen zorluk normal olur', () => {
    expect(parseProgress({ runs: [{ difficulty: 'x' }] }).runs[0].difficulty).toBe('normal');
  });
});
