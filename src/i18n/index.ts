import { getLocales } from 'expo-localization';
import { useSettings } from '@/state/store';
import type { Lang } from '@/state/schema';
import { en } from './en';
import { tr, type Dict } from './tr';

const dicts: Record<Lang, Dict> = { tr, en };

export function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode;
  return code === 'tr' ? 'tr' : 'en';
}

export function useT() {
  const { lang } = useSettings();
  const l = lang ?? deviceLang();
  const d = dicts[l];
  return Object.assign(
    (key: keyof Dict, vars?: Record<string, string | number>) => {
      let s = d[key] ?? tr[key];
      if (vars) for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
      return s;
    },
    { lang: l, locale: l === 'tr' ? 'tr-TR' : 'en-US' }
  );
}

export type { Dict };
