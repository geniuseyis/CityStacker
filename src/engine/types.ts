export type Difficulty = 'easy' | 'normal' | 'hard';

export type Phase = 'swinging' | 'dropping' | 'falling' | 'over';

export type Grade = 'perfect' | 'good' | 'ok';

export type OverReason = 'collapse' | 'lives';

// cx: kule uzayında blok merkezi. lit: 6 pencerenin bit maskesi
export type Block = { level: number; cx: number; rot: number; style: number; lit: number };

// sallanan / düşen blok, ekran (view) uzayında sol-üst köşe
export type Hanging = { x: number; y: number; style: number; lit: number };

export type GameEvent =
  | { type: 'drop' }
  | { type: 'land'; grade: Grade; combo: number; points: number; x: number; y: number }
  | { type: 'miss'; livesLeft: number; x: number; y: number }
  | { type: 'collapse'; x: number; y: number }
  | { type: 'respawn' }
  | { type: 'over'; reason: OverReason }
  | { type: 'continue' };

export type Input = { tick: number; kind: 'drop' | 'continue' };

export type GameState = {
  seed: number;
  rng: number;
  difficulty: Difficulty;
  tick: number;
  phase: Phase;
  overReason: OverReason | null;

  blocks: Block[];
  cur: Hanging | null;

  swingT: number;
  swayT: number;
  fallV: number;
  speedMul: number;
  speedTarget: number;

  camX: number;
  camCenterX: number;
  camCenterTarget: number;
  camY: number;
  camYTarget: number;

  score: number;
  combo: number;
  bestCombo: number;
  perfects: number;
  lives: number;
  continues: number;

  inputs: Input[];
  events: GameEvent[];
};
