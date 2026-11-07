import { continueRun, createGame, drop, step } from './game';
import type { RunRecord } from './replay';
import type { GameState } from './types';

// Hayalet: kayıtlı bir koşu, oyuncunun oyunuyla aynı adımda yeniden oynatılır.
// Girdiler replay ile aynı sırada uygulanır (o adımın girdileri, sonra adım).

export type Ghost = { s: GameState; rec: RunRecord; i: number };

export function makeGhost(rec: RunRecord): Ghost {
  return { s: createGame(rec.seed, rec.difficulty, { weather: rec.weather }), rec, i: 0 };
}

export function stepGhost(g: Ghost) {
  const { s, rec } = g;
  while (g.i < rec.inputs.length && rec.inputs[g.i].tick === s.tick) {
    const inp = rec.inputs[g.i++];
    if (inp.kind === 'drop') drop(s);
    else continueRun(s);
  }
  step(s);
  s.events.length = 0;
}
