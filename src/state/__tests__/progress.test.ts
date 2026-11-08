import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, MAX_RUNS, MAX_TOKENS, START_TOKENS, parseProgress } from '../schema';

describe('parseProgress', () => {
  it('bozuk kayit varsayilan ilerlemeye doner', () => {
    expect(parseProgress(undefined)).toEqual(DEFAULT_PROGRESS);
  });
});
