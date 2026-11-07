import * as Haptics from 'expo-haptics';
import type { GameEvent } from '@/engine';
import { getSettings } from '@/state/store';
import { playSfx } from './sound';

const swallow = (p: Promise<unknown>) => p.catch(() => {});

export function tapFeedback() {
  playSfx('click');
  if (getSettings().haptics) swallow(Haptics.selectionAsync());
}

// oyun olaylarına ses + titreşim
export function gameFeedback(ev: GameEvent) {
  const h = getSettings().haptics;
  switch (ev.type) {
    case 'drop':
      playSfx('drop');
      if (h) swallow(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      break;
    case 'land':
      if (ev.grade === 'perfect') {
        playSfx('perfect');
        if (h) swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      } else {
        playSfx('place');
        if (h)
          swallow(
            Haptics.impactAsync(
              ev.grade === 'good' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Rigid
            )
          );
      }
      break;
    case 'miss':
      playSfx('crash');
      if (h) swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
      break;
    case 'topple':
      playSfx('crash');
      if (h) swallow(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      break;
    case 'over':
      if (h) swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      break;
    default:
      break;
  }
}
