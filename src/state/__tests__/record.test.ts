import { describe, expect, it } from 'vitest';
import { parseProgress, parseRecord } from '../schema';

const rec = (over: object = {}) => ({
  v: 5,
  seed: 42,
  difficulty: 'normal',
  weather: 'clear',
  inputs: [
    { tick: 10, kind: 'drop' },
    { tick: 20, kind: 'drop' },
  ],
  score: 100,
  floors: 2,
  ...over,
});

describe('parseRecord', () => {
  it('gecerli kayit okunur', () => {
    expect(parseRecord(rec())).toEqual(rec());
  });
});
