import { isPro } from '@/state/store';

// Reklam arayüzü. AdMob hesabı açılınca react-native-google-mobile-ads buraya
// bağlanacak (UMP onay formu + iOS'ta ATT ile). Pro kullanıcıya geçiş reklamı yok;
// ödüllü reklam isteğe bağlı olduğu için Pro'da da açık.

const SIMULATE = __DEV__; // geliştirmede sahte reklam ekranı (ui/AdHost)
const INTERSTITIAL_EVERY = 3;
let gamesSinceAd = 0;

type Listener = (done: (watched: boolean) => void) => void;
let host: Listener | null = null;

// AdHost bileşeni kendini buraya kaydeder
export function registerAdHost(l: Listener | null) {
  host = l;
}

export const adsEnabled = () => !isPro();

export function rewardedReady(): boolean {
  return SIMULATE && !!host;
}

// izlenip sonuna kadar gelinirse true
export function showRewarded(): Promise<boolean> {
  if (!rewardedReady()) return Promise.resolve(false);
  return new Promise((resolve) => host!(resolve));
}

// oyun sonu sayacı; zamanı gelince geçiş reklamı gösterir
export async function onGameFinished(): Promise<void> {
  if (!adsEnabled()) return;
  gamesSinceAd += 1;
  if (gamesSinceAd < INTERSTITIAL_EVERY) return;
  gamesSinceAd = 0;
  // TODO(admob): interstitial.show()
}
