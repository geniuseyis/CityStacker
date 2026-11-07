import type { Difficulty, Input, RunRecord, Weather } from '@/engine';

// Diskten gelen her şey güvenilmez kabul edilir: tip kontrolü + sınırlar.

export type Lang = 'tr' | 'en';

export type Settings = {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  difficulty: Difficulty;
  theme: string;
  skin: string; // kat stili (kozmetik)
  crane: string; // vinç rengi, 'theme': temanın kendi rengi
  lang: Lang | null; // null: cihaz dili
  reducedMotion: boolean;
  guide: boolean; // nişan yardımı: tahmini iniş noktası
};

export type RunEntry = { score: number; floors: number; difficulty: Difficulty; ts: number; daily?: string };

export type ProPlan = 'weekly' | 'monthly' | 'lifetime';

// until: abonelik bitişi (ms), ömür boyu için null
export type ProState = { plan: ProPlan; until: number | null };

// günlük ödül serisi: son alınan gün, serideki gün (1-7), saat geri alınmasın diye zaman damgası
export type Streak = { last: string | null; day: number; at: number };

// görevlerin tanımı tarihten türetilir, burada sadece ilerleme durur
export type MissionProgress = { id: string; progress: number; claimed: boolean };

export type Progress = {
  tokens: number;
  best: Record<Difficulty, number>;
  bestFloors: number;
  games: number;
  totalFloors: number;
  totalPerfects: number;
  runs: RunEntry[];
  daily: { date: string; best: number } | null;
  tutorialDone: boolean;
  pro: ProState | null;
  owned: string[];
  streak: Streak;
  missions: { date: string; items: MissionProgress[] } | null;
  adTokens: { date: string; count: number } | null;
  proGiftAt: number;
  starter: boolean;
  ghosts: Partial<Record<Difficulty, RunRecord>>;
};

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  haptics: true,
  difficulty: 'normal',
  theme: 'dusk',
  skin: 'classic',
  crane: 'theme',
  lang: null,
  reducedMotion: false,
  guide: false,
};

// bedava hak olmadığı için yeni oyuncu birkaç jetonla başlar
export const START_TOKENS = 5;
export const MAX_TOKENS = 99999;
const MAX_RUNS = 30;
const MAX_GHOST_INPUTS = 3000;

export const DEFAULT_PROGRESS: Progress = {
  tokens: START_TOKENS,
  best: { easy: 0, normal: 0, hard: 0 },
  bestFloors: 0,
  games: 0,
  totalFloors: 0,
  totalPerfects: 0,
  runs: [],
  daily: null,
  tutorialDone: false,
  pro: null,
  owned: [],
  streak: { last: null, day: 0, at: 0 },
  missions: null,
  adTokens: null,
  proGiftAt: 0,
  starter: false,
  ghosts: {},
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const int = (v: unknown, d: number, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : d;
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const WEATHERS: Weather[] = ['clear', 'windy', 'storm', 'fog'];
const diff = (v: unknown, d: Difficulty): Difficulty => (DIFFS.includes(v as Difficulty) ? (v as Difficulty) : d);
const str = (v: unknown, max = 40) => (typeof v === 'string' && v.length <= max ? v : null);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v: unknown) => {
  const s = str(v, 10);
  return s && DATE_RE.test(s) ? s : null;
};
const ID_RE = /^[a-z0-9.]{1,40}$/;

export function parseSettings(raw: unknown): Settings {
  if (!isObj(raw)) return { ...DEFAULT_SETTINGS };
  const d = DEFAULT_SETTINGS;
  const id = (v: unknown, fb: string) => {
    const s = str(v);
    return s && ID_RE.test(s) ? s : fb;
  };
  return {
    sound: bool(raw.sound, d.sound),
    music: bool(raw.music, d.music),
    haptics: bool(raw.haptics, d.haptics),
    difficulty: diff(raw.difficulty, d.difficulty),
    theme: id(raw.theme, d.theme),
    skin: id(raw.skin, d.skin),
    crane: id(raw.crane, d.crane),
    lang: raw.lang === 'tr' || raw.lang === 'en' ? raw.lang : null,
    reducedMotion: bool(raw.reducedMotion, d.reducedMotion),
    guide: bool(raw.guide, d.guide),
  };
}

function parseRun(v: unknown): RunEntry | null {
  if (!isObj(v)) return null;
  const daily = date(v.daily);
  return {
    score: int(v.score, 0),
    floors: int(v.floors, 0, 100000),
    difficulty: diff(v.difficulty, 'normal'),
    ts: int(v.ts, 0),
    ...(daily ? { daily } : null),
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

// Hayalet kaydı: sadece şekli doğrulanır. Oynanırken motor kaydı baştan oynatır,
// tutarsız bir kayıt sadece garip bir hayalet üretir, oyuna zarar vermez.
export function parseRecord(v: unknown): RunRecord | null {
  if (!isObj(v) || v.v !== 1 || !Array.isArray(v.inputs) || v.inputs.length > MAX_GHOST_INPUTS) return null;
  if (!WEATHERS.includes(v.weather as Weather)) return null;
  const inputs: Input[] = [];
  let last = 0;
  for (const i of v.inputs) {
    if (!isObj(i) || (i.kind !== 'drop' && i.kind !== 'continue')) return null;
    const tick = int(i.tick, -1);
    if (tick < last) return null;
    last = tick;
    inputs.push({ tick, kind: i.kind });
  }
  return {
    v: 1,
    seed: int(v.seed, 0, 0xffffffff),
    difficulty: diff(v.difficulty, 'normal'),
    weather: v.weather as Weather,
    inputs,
    score: int(v.score, 0),
    floors: int(v.floors, 0, 100000),
  };
}

export function parseProgress(raw: unknown): Progress {
  const d = DEFAULT_PROGRESS;
  if (!isObj(raw)) return { ...d, best: { ...d.best }, runs: [], owned: [], streak: { ...d.streak }, ghosts: {} };
  const best = isObj(raw.best) ? raw.best : {};
  const daily = isObj(raw.daily) ? raw.daily : null;
  const dailyDate = daily ? date(daily.date) : null;
  const streak = isObj(raw.streak) ? raw.streak : {};
  const missions = isObj(raw.missions) ? raw.missions : null;
  const missionDate = missions ? date(missions.date) : null;
  const ad = isObj(raw.adTokens) ? raw.adTokens : null;
  const adDate = ad ? date(ad.date) : null;
  const ghosts: Partial<Record<Difficulty, RunRecord>> = {};
  if (isObj(raw.ghosts)) {
    for (const k of DIFFS) {
      const r = parseRecord(raw.ghosts[k]);
      if (r && r.difficulty === k) ghosts[k] = r;
    }
  }
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
    daily: dailyDate && daily ? { date: dailyDate, best: int(daily.best, 0) } : null,
    tutorialDone: bool(raw.tutorialDone, false),
    pro: parsePro(raw.pro),
    owned: Array.isArray(raw.owned)
      ? raw.owned.filter((o): o is string => typeof o === 'string' && ID_RE.test(o)).slice(0, 100)
      : [],
    streak: { last: date(streak.last), day: int(streak.day, 0, 7), at: int(streak.at, 0) },
    missions:
      missions && missionDate && Array.isArray(missions.items)
        ? {
            date: missionDate,
            items: missions.items
              .filter(isObj)
              .slice(0, 5)
              .map((m) => ({
                id: str(m.id) ?? '',
                progress: int(m.progress, 0, 1_000_000),
                claimed: bool(m.claimed, false),
              })),
          }
        : null,
    adTokens: ad && adDate ? { date: adDate, count: int(ad.count, 0, 100) } : null,
    proGiftAt: int(raw.proGiftAt, 0),
    starter: bool(raw.starter, false),
    ghosts,
  };
}

export { MAX_RUNS };
