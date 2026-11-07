import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { Weather } from '@/engine';

type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const WEATHER_ICON: Record<Weather, MciName> = {
  clear: 'weather-sunny',
  windy: 'weather-windy',
  storm: 'weather-lightning-rainy',
  fog: 'weather-fog',
};
