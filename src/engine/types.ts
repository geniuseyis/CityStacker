export type Difficulty = 'easy' | 'normal' | 'hard';

// swinging: vinçte | dropping: serbest düşüş | falling: ıska, ekrandan düşüyor
// settling: devrilen bölüm yıkılırken kısa bekleme | over: bitti
export type Phase = 'swinging' | 'dropping' | 'falling' | 'settling' | 'over';

export type Grade = 'perfect' | 'good' | 'ok';

// miss: kat ıskalayıp düştü | tipped: kenardan devrildi | collapse: kule bölümü yıkıldı
export type OverReason = 'miss' | 'tipped' | 'collapse';

// cx: kule uzayında (dinlenme konumu) kat merkezi. lit: 6 pencerenin bit maskesi
export type Block = { level: number; cx: number; style: number; lit: number };

// vinçteki / havadaki kat, ekran (view) uzayında sol-üst köşe. rot: derece (devrilirken)
export type Hanging = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  style: number;
  lit: number;
};

export type ToppledBlock = { x: number; y: number; style: number; lit: number };

export type GameEvent =
  | { type: 'drop' }
  | { type: 'land'; grade: Grade; combo: number; points: number; x: number; y: number }
  | { type: 'miss'; livesLeft: number; x: number; y: number; tipped: boolean }
  // ağırlık merkezi desteği aştı: bölüm pivot etrafında devrilir (renderer canlandırır)
  | { type: 'topple'; livesLeft: number; dir: 1 | -1; pivotX: number; pivotY: number; blocks: ToppledBlock[] }
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
  lastLoss: OverReason | null;
  waitT: number;

  blocks: Block[];
  cur: Hanging | null;

  // sarkaç
  rope: number;
  theta: number;
  omega: number;
  side: 1 | -1;

  // kule esnekliği: tepe noktasının yer değiştirmesi
  wob: number;
  wobV: number;
  windT: number;

  camX: number;
  camXTarget: number;
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
