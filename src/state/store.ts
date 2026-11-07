import { useSyncExternalStore } from 'react';
import type { Difficulty, RunRecord } from '@/engine';
import { readJSON, writeJSON } from '@/services/storage';
import { isOwned, type Unlock } from './cosmetics';
import { todayKey } from './daily';
import { advance, missionsFor, type Mission, type RunStats } from './missions';
import {
  MAX_RUNS,
  MAX_TOKENS,
  isProActive,
  parseProgress,
  parseSettings,
  type ProPlan,
  type Progress,
  type RunEntry,
  type Settings,
} from './schema';

const K_SETTINGS = 'settings.v2';
const K_PROGRESS = 'progress.v2';

const DAY = 24 * 60 * 60 * 1000;

// ekonomi ayarları
export const DAILY_REWARDS = [2, 3, 4, 5, 6, 8, 12];
export const AD_TOKENS = 3;
export const AD_DAILY_MAX = 5;
export const PRO_GIFT = 10;
export const STARTER_TOKENS = 30;

type State = { settings: Settings; progress: Progress };

let state: State | null = null;
const listeners = new Set<() => void>();

function get(): State {
  if (!state) {
    state = {
      settings: readJSON(K_SETTINGS, parseSettings),
      progress: readJSON(K_PROGRESS, parseProgress),
    };
  }
  return state;
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, () => get().settings);
}

export function useProgress() {
  return useSyncExternalStore(subscribe, () => get().progress);
}

export const getSettings = () => get().settings;
export const getProgress = () => get().progress;

export function updateSettings(patch: Partial<Settings>) {
  const s = get();
  state = { ...s, settings: { ...s.settings, ...patch } };
  writeJSON(K_SETTINGS, state.settings);
  emit();
}

function setProgress(next: Progress) {
  state = { ...get(), progress: next };
  writeJSON(K_PROGRESS, next);
  emit();
}

const clampTokens = (n: number) => Math.max(0, Math.min(MAX_TOKENS, Math.floor(n)));

export function spendTokens(n: number): boolean {
  const p = get().progress;
  if (n <= 0 || p.tokens < n) return false;
  setProgress({ ...p, tokens: p.tokens - n });
  return true;
}

export function addTokens(n: number) {
  const p = get().progress;
  if (!Number.isFinite(n) || n <= 0) return;
  setProgress({ ...p, tokens: clampTokens(p.tokens + n) });
}

/* ------------------------------ Pro ------------------------------ */

// mağaza doğruladıktan sonra çağrılır (bkz. services/purchases)
export function setPro(plan: ProPlan | null) {
  const p = get().progress;
  if (!plan) {
    setProgress({ ...p, pro: null });
    return;
  }
  const until = plan === 'lifetime' ? null : Date.now() + (plan === 'weekly' ? 7 : 30) * DAY;
  setProgress({ ...p, pro: { plan, until } });
}

export function useIsPro() {
  return isProActive(useProgress().pro);
}

export const isPro = () => isProActive(get().progress.pro);

// Pro: her 7 günde bir jeton hediyesi
export function proGiftReady(p: Progress, now = Date.now()) {
  return isProActive(p.pro, now) && now - p.proGiftAt >= 7 * DAY;
}

export function claimProGift(): boolean {
  const p = get().progress;
  if (!proGiftReady(p)) return false;
  setProgress({ ...p, tokens: clampTokens(p.tokens + PRO_GIFT), proGiftAt: Date.now() });
  return true;
}

/* -------------------------- günlük ödül -------------------------- */

function dayBefore(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d - 1));
}

export type DailyStatus = { claimable: boolean; day: number; reward: number; claimedToday: boolean };

// Seri: art arda her gün alınırsa 1→7 ilerler, bir gün kaçarsa başa döner.
// Saat geri alınarak tekrar tekrar ödül toplanmasın diye son alımın zamanı da tutulur.
export function dailyStatus(p: Progress, now = Date.now()): DailyStatus {
  const today = todayKey(new Date(now));
  if (p.streak.last === today) {
    return { claimable: false, day: p.streak.day, reward: DAILY_REWARDS[p.streak.day - 1] ?? 0, claimedToday: true };
  }
  const day = p.streak.last && p.streak.last === dayBefore(today) ? (p.streak.day % 7) + 1 : 1;
  const clockOk = now >= p.streak.at - 60 * 60 * 1000;
  return { claimable: clockOk, day, reward: DAILY_REWARDS[day - 1], claimedToday: false };
}

export function claimDaily(multiplier = 1): number {
  const p = get().progress;
  const st = dailyStatus(p);
  if (!st.claimable) return 0;
  const amount = st.reward * multiplier;
  setProgress({
    ...p,
    tokens: clampTokens(p.tokens + amount),
    streak: { last: todayKey(), day: st.day, at: Date.now() },
  });
  return amount;
}

/* ---------------------------- görevler ---------------------------- */

export type MissionView = Mission & { progress: number; claimed: boolean; done: boolean };

export function missionView(p: Progress, today = todayKey()): MissionView[] {
  const saved = p.missions?.date === today ? p.missions.items : [];
  return missionsFor(today).map((m) => {
    const s = saved.find((x) => x.id === m.id);
    const progress = s?.progress ?? 0;
    return { ...m, progress, claimed: s?.claimed ?? false, done: progress >= m.target };
  });
}

export function claimMission(id: string): number {
  const p = get().progress;
  const today = todayKey();
  const list = missionView(p, today);
  const m = list.find((x) => x.id === id);
  if (!m || !m.done || m.claimed) return 0;
  setProgress({
    ...p,
    tokens: clampTokens(p.tokens + m.reward),
    missions: {
      date: today,
      items: list.map((x) => ({ id: x.id, progress: x.progress, claimed: x.id === id ? true : x.claimed })),
    },
  });
  return m.reward;
}

/* ------------------------- reklamla jeton ------------------------- */

export function adTokensLeft(p: Progress, today = todayKey()) {
  const used = p.adTokens?.date === today ? p.adTokens.count : 0;
  return Math.max(0, AD_DAILY_MAX - used);
}

// reklam gerçekten izlendikten sonra çağrılır (services/ads)
export function grantAdTokens(): number {
  const p = get().progress;
  const today = todayKey();
  if (adTokensLeft(p, today) <= 0) return 0;
  const used = p.adTokens?.date === today ? p.adTokens.count : 0;
  setProgress({ ...p, tokens: clampTokens(p.tokens + AD_TOKENS), adTokens: { date: today, count: used + 1 } });
  return AD_TOKENS;
}

/* ---------------------------- kozmetik ---------------------------- */

export function owns(p: Progress, item: { id: string; unlock: Unlock }) {
  return isOwned(item, p.owned, isProActive(p.pro), p.starter);
}

export function buyCosmetic(item: { id: string; unlock: Unlock }): boolean {
  const p = get().progress;
  if (owns(p, item) || !('tokens' in item.unlock)) return false;
  const price = item.unlock.tokens;
  if (p.tokens < price) return false;
  setProgress({ ...p, tokens: p.tokens - price, owned: [...p.owned, item.id] });
  return true;
}

// başlangıç paketi: tek seferlik jeton + bakır kat stili
export function grantStarter() {
  const p = get().progress;
  if (p.starter) return;
  setProgress({ ...p, starter: true, tokens: clampTokens(p.tokens + STARTER_TOKENS) });
}

export function markTutorialDone() {
  setProgress({ ...get().progress, tutorialDone: true });
}

/* ---------------------------- oyun sonu ---------------------------- */

export type RunResult = RunStats & {
  difficulty: Difficulty;
  dailyKey?: string;
  record: RunRecord | null; // rekor kırılırsa hayalet olarak saklanır
};

export function recordRun(r: RunResult): { newBest: boolean } {
  const p = get().progress;
  const prevBest = r.dailyKey ? (p.daily?.date === r.dailyKey ? p.daily.best : 0) : p.best[r.difficulty];
  const newBest = r.score > prevBest;

  const entry: RunEntry = { score: r.score, floors: r.floors, difficulty: r.difficulty, ts: Date.now() };
  if (r.dailyKey) entry.daily = r.dailyKey;
  const runs = r.score > 0 ? [...p.runs, entry].sort((a, b) => b.score - a.score).slice(0, MAX_RUNS) : p.runs;

  // görev ilerlemesi
  const today = todayKey();
  const missions = missionView(p, today).map((m) => ({
    id: m.id,
    progress: m.claimed ? m.progress : advance(m, m.progress, r),
    claimed: m.claimed,
  }));

  const ghosts = { ...p.ghosts };
  if (!r.dailyKey && newBest && r.record) ghosts[r.difficulty] = r.record;

  setProgress({
    ...p,
    best: r.dailyKey || !newBest ? p.best : { ...p.best, [r.difficulty]: r.score },
    bestFloors: Math.max(p.bestFloors, r.floors),
    games: p.games + 1,
    totalFloors: p.totalFloors + r.floors,
    totalPerfects: p.totalPerfects + r.perfects,
    runs,
    daily: r.dailyKey ? { date: r.dailyKey, best: Math.max(prevBest, r.score) } : p.daily,
    missions: { date: today, items: missions },
    ghosts,
  });
  return { newBest };
}

export function resetProgress() {
  const p = get().progress;
  // rekor ve istatistikler silinir; satın alınan/kazanılan her şey korunur
  setProgress({
    ...parseProgress(undefined),
    tokens: p.tokens,
    owned: p.owned,
    pro: p.pro,
    proGiftAt: p.proGiftAt,
    starter: p.starter,
    streak: p.streak,
    adTokens: p.adTokens,
    missions: p.missions,
    tutorialDone: true,
  });
}

// ana menü rozeti: alınabilecek bir şey var mı
export function hasClaimable(p: Progress) {
  return dailyStatus(p).claimable || missionView(p).some((m) => m.done && !m.claimed) || proGiftReady(p);
}
