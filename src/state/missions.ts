import { nextRandom, seedFromString, type Weather } from '@/engine';

// Günlük görevler: her gün tarihten türetilen 3 görev. Tanımlar diskte tutulmaz,
// böylece hedef ya da ödül elle değiştirilemez; sadece ilerleme kaydedilir.

export type MissionKind =
  | 'perfectStreak' // tek oyunda üst üste mükemmel
  | 'floorsRun' // tek oyunda kat
  | 'perfects' // gün içinde toplam mükemmel
  | 'games' // oyun sayısı
  | 'scoreRun' // tek oyunda puan
  | 'dailyPlay' // günün kulesini oyna
  | 'weatherFloors' // rüzgârlı/fırtınalı havada tek oyunda kat
  | 'ghostBeat'; // hayaleti geç

export type Mission = { id: string; kind: MissionKind; target: number; reward: number };

const POOL: { kind: MissionKind; targets: number[]; reward: number }[] = [
  { kind: 'perfectStreak', targets: [3, 4, 5], reward: 3 },
  { kind: 'floorsRun', targets: [10, 15, 20], reward: 3 },
  { kind: 'perfects', targets: [10, 15, 25], reward: 2 },
  { kind: 'games', targets: [3, 5], reward: 2 },
  { kind: 'scoreRun', targets: [1000, 2000, 3000], reward: 3 },
  { kind: 'dailyPlay', targets: [1], reward: 2 },
  { kind: 'weatherFloors', targets: [6, 10], reward: 4 },
  { kind: 'ghostBeat', targets: [1], reward: 4 },
];

// bir oyunun sonunda görevlere işlenen özet
export type RunStats = {
  floors: number;
  score: number;
  perfects: number;
  perfectStreak: number;
  daily: boolean;
  weather: Weather;
  ghostBeaten: boolean;
};

export function missionsFor(day: string): Mission[] {
  const st = { rng: seedFromString('cs-missions:' + day) | 0 };
  const pool = POOL.slice();
  const out: Mission[] = [];
  while (out.length < 3 && pool.length) {
    const i = Math.floor(nextRandom(st) * pool.length);
    const p = pool.splice(i, 1)[0];
    const target = p.targets[Math.floor(nextRandom(st) * p.targets.length)];
    out.push({ id: `${p.kind}.${target}`, kind: p.kind, target, reward: p.reward });
  }
  return out;
}

// koşu sonucu göreve göre yeni ilerleme: "tek oyunda" olanlar en iyiyi, diğerleri toplamı tutar
export function advance(m: Mission, progress: number, r: RunStats): number {
  switch (m.kind) {
    case 'perfectStreak':
      return Math.max(progress, r.perfectStreak);
    case 'floorsRun':
      return Math.max(progress, r.floors);
    case 'scoreRun':
      return Math.max(progress, r.score);
    case 'perfects':
      return progress + r.perfects;
    case 'games':
      return progress + 1;
    case 'dailyPlay':
      return progress + (r.daily ? 1 : 0);
    case 'weatherFloors':
      return r.weather === 'windy' || r.weather === 'storm' ? Math.max(progress, r.floors) : progress;
    case 'ghostBeat':
      return progress + (r.ghostBeaten ? 1 : 0);
  }
}
