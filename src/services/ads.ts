import { isPro } from '@/state/store';

// Reklam arayüzü. AdMob hesabı açılınca react-native-google-mobile-ads buraya
// bağlanacak (UMP onay formu + iOS'ta ATT ile). Pro kullanıcıya hiç reklam yok.

const INTERSTITIAL_EVERY = 3; // her 3 oyunda bir, oyun sonunda
let gamesSinceAd = 0;

export const adsEnabled = () => !isPro();

// reklam izleyerek ücretsiz hak (Pro'da da açık kalabilir, kullanıcı isterse izler)
export function rewardedReady(): boolean {
  return false;
}

export async function showRewarded(): Promise<boolean> {
  return false;
}

// oyun sonu sayacı; zamanı gelince geçiş reklamı gösterir
export async function onGameFinished(): Promise<void> {
  if (!adsEnabled()) return;
  gamesSinceAd += 1;
  if (gamesSinceAd < INTERSTITIAL_EVERY) return;
  gamesSinceAd = 0;
  // TODO(admob): interstitial.show()
}
