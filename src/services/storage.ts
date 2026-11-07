import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createMMKV, type MMKV } from 'react-native-mmkv';

// Kayıtlar AES-256 ile şifreli MMKV'de, anahtar Keychain / Keystore'da.
// Amaç: jeton bakiyesi gibi verilerin dosyadan elle düzenlenememesi.

const KEY_NAME = 'cs.storage.key';

function loadKey(): string {
  let key = SecureStore.getItem(KEY_NAME);
  if (!key || key.length !== 32) {
    const bytes = getRandomBytes(16);
    key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    SecureStore.setItem(KEY_NAME, key, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  }
  return key;
}

type Store = Pick<MMKV, 'getString' | 'set' | 'remove'>;

let store: Store | null = null;

// keychain erişilemezse (çok nadir) şifresiz diske düşmek yerine sadece bellekte tut
function memoryStore(): Store {
  const m = new Map<string, string>();
  return {
    getString: (k) => m.get(k),
    set: (k, v) => void m.set(k, String(v)),
    remove: (k) => m.delete(k),
  };
}

function db(): Store {
  if (store) return store;
  try {
    store = createMMKV({ id: 'cs-save', encryptionKey: loadKey(), encryptionType: 'AES-256' });
  } catch {
    store = memoryStore();
  }
  return store;
}

export function readJSON<T>(key: string, parse: (raw: unknown) => T): T {
  let raw: unknown = undefined;
  try {
    const str = db().getString(key);
    if (str) raw = JSON.parse(str);
  } catch {
    raw = undefined;
  }
  return parse(raw);
}

export function writeJSON(key: string, value: unknown) {
  try {
    db().set(key, JSON.stringify(value));
  } catch {
    /* disk dolu vs. — oyunu durdurmaya değmez */
  }
}

export function removeKey(key: string) {
  try {
    db().remove(key);
  } catch {
    /* yok say */
  }
}
