import { continueRun, createGame, drop, step } from './game';
import type { Difficulty, GameState, Input } from './types';

export type RunRecord = {
  v: 1;
  seed: number;
  difficulty: Difficulty;
  inputs: Input[];
  score: number;
  floors: number;
};

export function toRecord(s: GameState): RunRecord {
  return {
    v: 1,
    seed: s.seed,
    difficulty: s.difficulty,
    inputs: s.inputs.slice(),
    score: s.score,
    floors: s.blocks.length,
  };
}

// Kaydı baştan oynatır. Online skor doğrulamada sunucu da bunu çalıştıracak.
export function simulate(seed: number, difficulty: Difficulty, inputs: Input[], maxTicks = 120 * 60 * 30): GameState {
  const s = createGame(seed, difficulty);
  let i = 0;
  while (s.tick < maxTicks) {
    while (i < inputs.length && inputs[i].tick === s.tick) {
      const inp = inputs[i++];
      if (inp.kind === 'drop') drop(s);
      else continueRun(s);
    }
    if (i >= inputs.length && s.phase === 'over') break;
    if (i < inputs.length && inputs[i].tick < s.tick) break; // bozuk kayıt
    step(s);
  }
  s.events.length = 0;
  return s;
}

export function verify(r: RunRecord): boolean {
  if (r.v !== 1 || !Array.isArray(r.inputs)) return false;
  for (let k = 1; k < r.inputs.length; k++) {
    if (r.inputs[k].tick < r.inputs[k - 1].tick) return false;
  }
  const s = simulate(r.seed, r.difficulty, r.inputs);
  return s.phase === 'over' && s.score === r.score && s.blocks.length === r.floors;
}
