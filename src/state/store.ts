import { useSyncExternalStore } from 'react';
import type { Difficulty } from '@/engine';
import { readJSON, writeJSON } from '@/services/storage';
import {
  MAX_RUNS,
  MAX_TOKENS,
  parseProgress,
  parseSettings,
  type Progress,
  type RunEntry,
  type Settings,
} from './schema';

const K_SETTINGS = 'settings.v2';
const K_PROGRESS = 'progress.v2';

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

export function spendTokens(n: number): boolean {
  const p = get().progress;
  if (n <= 0 || p.tokens < n) return false;
  setProgress({ ...p, tokens: p.tokens - n });
  return true;
}

export function addTokens(n: number) {
  const p = get().progress;
  if (!Number.isFinite(n) || n <= 0) return;
  setProgress({ ...p, tokens: Math.min(MAX_TOKENS, p.tokens + Math.floor(n)) });
}

export function markTutorialDone() {
  setProgress({ ...get().progress, tutorialDone: true });
}

export type RunResult = {
  score: number;
  floors: number;
  perfects: number;
  difficulty: Difficulty;
  daily?: string;
};

// oyun bitince çağrılır; yeni rekor mu döner
export function recordRun(r: RunResult): { newBest: boolean } {
  const p = get().progress;
  const prevBest = r.daily ? (p.daily?.date === r.daily ? p.daily.best : 0) : p.best[r.difficulty];
  const newBest = r.score > prevBest;

  const entry: RunEntry = { score: r.score, floors: r.floors, difficulty: r.difficulty, ts: Date.now() };
  if (r.daily) entry.daily = r.daily;
  const runs = r.score > 0 ? [...p.runs, entry].sort((a, b) => b.score - a.score).slice(0, MAX_RUNS) : p.runs;

  setProgress({
    ...p,
    best: r.daily || !newBest ? p.best : { ...p.best, [r.difficulty]: r.score },
    bestFloors: Math.max(p.bestFloors, r.floors),
    games: p.games + 1,
    totalFloors: p.totalFloors + r.floors,
    totalPerfects: p.totalPerfects + r.perfects,
    runs,
    daily: r.daily ? { date: r.daily, best: Math.max(prevBest, r.score) } : p.daily,
  });
  return { newBest };
}

export function resetProgress() {
  const p = get().progress;
  // jetonlar ve açılmış temalar satın alma/emek ürünü, sıfırlamada korunur
  setProgress({ ...parseProgress(undefined), tokens: p.tokens, unlocked: p.unlocked, tutorialDone: true });
}
