// Ödüllü reklam arayüzü. AdMob hesabı açılınca react-native-google-mobile-ads
// buraya bağlanacak (UMP onay formu + ATT ile birlikte). O zamana kadar kapalı.

export function rewardedReady(): boolean {
  return false;
}

export async function showRewarded(): Promise<boolean> {
  return false;
}
