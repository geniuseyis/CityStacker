export type Difficulty = 'easy' | 'normal' | 'hard';

export type Weather = 'clear' | 'windy' | 'storm' | 'fog';

// swinging: vinçte | dropping: serbest düşüş | falling: ıska, ekrandan düşüyor
// over: bitti
export type Phase = 'swinging' | 'dropping' | 'falling' | 'over';

export type Grade = 'perfect' | 'good' | 'ok';

// miss: kat ıskalayıp düştü | tipped: kenardan devrildi
export type OverReason = 'miss' | 'tipped';

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

export type FallenBlock = { x: number; y: number; style: number; lit: number };

export type GameEvent =
  | { type: 'drop' }
  | { type: 'land'; grade: Grade; combo: number; points: number; x: number; y: number }
  | { type: 'miss'; livesLeft: number; x: number; y: number; tipped: boolean }
  // kenardan düşen kat tepeden kat kopardı (renderer düşürür)
  | { type: 'knock'; dir: 1 | -1; blocks: FallenBlock[] }
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

  blocks: Block[];
  cur: Hanging | null;

  // sarkaç
  rope: number;
  theta: number;
  omega: number;
  side: 1 | -1;

  // hava: yan rüzgâr yönü, fırtınada ani esinti (birim/sn²) ve bir sonrakine kalan süre
  weather: Weather;
  windDir: 1 | -1;
  gust: number;
  gustT: number;

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
  // kombo sayacının kalan süresi (sn)
  comboT: number;
  // geçerli katın vince geldiği adım (hız bonusu için)
  spawnTick: number;
  bestCombo: number;
  perfects: number;
  lives: number;
  continues: number;

  inputs: Input[];
  events: GameEvent[];
};
