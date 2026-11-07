import { seedFromString } from '@/engine';

// yerel tarihe göre gün anahtarı: herkes kendi gününde aynı kuleyi oynar
export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const dailySeed = (key: string) => seedFromString('cs-daily:' + key);
