import type { Difficulty } from '@/engine';

// Diskten gelen her şey güvenilmez kabul edilir: tip kontrolü + sınırlar.

export type Lang = 'tr' | 'en';

export type Settings = {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  difficulty: Difficulty;
  theme: string;
  lang: Lang | null; // null: cihaz dili
  reducedMotion: boolean;
  guide: boolean; // nişan yardımı: tahmini iniş noktası
};

export type RunEntry = { score: number; floors: number; difficulty: Difficulty; ts: number; daily?: string };

export type ProPlan = 'weekly' | 'monthly' | 'lifetime';

// until: abonelik bitişi (ms), ömür boyu için null
export type ProState = { plan: ProPlan; until: number | null };

export type Progress = {
  tokens: number;
  best: Record<Difficulty, number>;
  bestFloors: number;
  games: number;
  totalFloors: number;
  totalPerfects: number;
  runs: RunEntry[];
  daily: { date: string; best: number } | null;
  unlocked: string[];
  tutorialDone: boolean;
  pro: ProState | null;
};

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  haptics: true,
  difficulty: 'normal',
  theme: 'dusk',
  lang: null,
  reducedMotion: false,
  guide: false,
};

// bedava hak olmadığı için yeni oyuncu birkaç jetonla başlar
export const START_TOKENS = 5;
export const MAX_TOKENS = 99999;
const MAX_RUNS = 30;

export const DEFAULT_PROGRESS: Progress = {
  tokens: START_TOKENS,
  best: { easy: 0, normal: 0, hard: 0 },
  bestFloors: 0,
  games: 0,
  totalFloors: 0,
  totalPerfects: 0,
  runs: [],
  daily: null,
  unlocked: ['dusk'],
  tutorialDone: false,
  pro: null,
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const int = (v: unknown, d: number, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : d;
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const diff = (v: unknown, d: Difficulty): Difficulty => (DIFFS.includes(v as Difficulty) ? (v as Difficulty) : d);
const str = (v: unknown, max = 40) => (typeof v === 'string' && v.length <= max ? v : null);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseSettings(raw: unknown): Settings {
  if (!isObj(raw)) return { ...DEFAULT_SETTINGS };
  const d = DEFAULT_SETTINGS;
  return {
    sound: bool(raw.sound, d.sound),
    music: bool(raw.music, d.music),
    haptics: bool(raw.haptics, d.haptics),
    difficulty: diff(raw.difficulty, d.difficulty),
    theme: str(raw.theme) ?? d.theme,
    lang: raw.lang === 'tr' || raw.lang === 'en' ? raw.lang : null,
    reducedMotion: bool(raw.reducedMotion, d.reducedMotion),
    guide: bool(raw.guide, d.guide),
  };
}

function parseRun(v: unknown): RunEntry | null {
  if (!isObj(v)) return null;
  const daily = str(v.daily, 10);
  return {
    score: int(v.score, 0),
    floors: int(v.floors, 0, 100000),
    difficulty: diff(v.difficulty, 'normal'),
    ts: int(v.ts, 0),
    ...(daily && DATE_RE.test(daily) ? { daily } : null),
  };
}

// Not: gerçek satın almada Pro durumu mağazadan (RevenueCat) okunur, buradaki
// kayıt sadece çevrimdışıyken son bilinen durumu göstermek için.
function parsePro(v: unknown): ProState | null {
  if (!isObj(v)) return null;
  const plan = v.plan === 'weekly' || v.plan === 'monthly' || v.plan === 'lifetime' ? v.plan : null;
  if (!plan) return null;
  const until = plan === 'lifetime' ? null : typeof v.until === 'number' && Number.isFinite(v.until) ? v.until : 0;
  return { plan, until };
}

export const isProActive = (p: ProState | null, now = Date.now()) => !!p && (p.until === null || p.until > now);

export function parseProgress(raw: unknown): Progress {
  const d = DEFAULT_PROGRESS;
  if (!isObj(raw)) return { ...d, best: { ...d.best }, runs: [], unlocked: [...d.unlocked] };
  const best = isObj(raw.best) ? raw.best : {};
  const daily = isObj(raw.daily) ? raw.daily : null;
  const dailyDate = daily ? str(daily.date, 10) : null;
  const unlocked = Array.isArray(raw.unlocked)
    ? raw.unlocked
        .map((u) => str(u))
        .filter((u): u is string => !!u)
        .slice(0, 50)
    : [];
  return {
    tokens: int(raw.tokens, d.tokens, MAX_TOKENS),
    best: { easy: int(best.easy, 0), normal: int(best.normal, 0), hard: int(best.hard, 0) },
    bestFloors: int(raw.bestFloors, 0),
    games: int(raw.games, 0),
    totalFloors: int(raw.totalFloors, 0),
    totalPerfects: int(raw.totalPerfects, 0),
    runs: Array.isArray(raw.runs)
      ? raw.runs
          .map(parseRun)
          .filter((r): r is RunEntry => !!r)
          .slice(0, MAX_RUNS)
      : [],
    daily: dailyDate && DATE_RE.test(dailyDate) ? { date: dailyDate, best: int(daily!.best, 0) } : null,
    unlocked: unlocked.includes('dusk') ? unlocked : ['dusk', ...unlocked],
    tutorialDone: bool(raw.tutorialDone, false),
    pro: parsePro(raw.pro),
  };
}

export { MAX_RUNS };
