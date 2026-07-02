import AsyncStorage from '@react-native-async-storage/async-storage';

export type Difficulty = 'kolay' | 'normal' | 'zor';

export type Settings = {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  difficulty: Difficulty;
  theme: string;
};

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  vibration: true,
  difficulty: 'normal',
  theme: 'gunduz',
};

const KEY_SETTINGS = 'cs_settings_v1';
const KEY_HIGHSCORE = 'cs_highscore_v1';
const KEY_BEST_FLOORS = 'cs_bestfloors_v1';
const KEY_LEADERBOARD = 'cs_leaderboard_v1';
const KEY_PLAYER = 'cs_player_v1';

export type ScoreEntry = {
  name: string;
  score: number;
  floors: number;
  ts: number;
};

const MAX_ENTRIES = 25;

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
  } catch {
    /* yok say */
  }
}

export async function loadHighScore(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_HIGHSCORE);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function loadBestFloors(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_BEST_FLOORS);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function saveRecord(score: number, floors: number): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [KEY_HIGHSCORE, String(score)],
      [KEY_BEST_FLOORS, String(floors)],
    ]);
  } catch {
    /* yok say */
  }
}

export async function resetRecord(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY_HIGHSCORE, KEY_BEST_FLOORS, KEY_LEADERBOARD]);
  } catch {
    /* yok say */
  }
}

export async function loadPlayerName(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PLAYER);
    return raw && raw.trim() ? raw : 'Oyuncu';
  } catch {
    return 'Oyuncu';
  }
}

export async function savePlayerName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PLAYER, name.trim().slice(0, 16) || 'Oyuncu');
  } catch {
    /* yok say */
  }
}

export async function loadLeaderboard(): Promise<ScoreEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_LEADERBOARD);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function addToLeaderboard(entry: ScoreEntry): Promise<ScoreEntry[]> {
  try {
    const list = await loadLeaderboard();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(KEY_LEADERBOARD, JSON.stringify(trimmed));
    return trimmed;
  } catch {
    return [];
  }
}
