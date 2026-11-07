import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/sora';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initSound, pauseMusic, setMusicEnabled, setSoundEnabled, startMusic } from '@/services/sound';
import { getSettings, useSettings } from '@/state/store';
import { color } from '@/ui/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 350, fade: true });
SystemUI.setBackgroundColorAsync(color.bg).catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
  });
  const { sound, music } = useSettings();

  useEffect(() => {
    initSound().then(() => {
      if (getSettings().music && AppState.currentState === 'active') startMusic();
    });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') startMusic();
      else pauseMusic();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => setSoundEnabled(sound), [sound]);
  useEffect(() => setMusicEnabled(music), [music]);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.bg },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="play" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen
            name="settings"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.92],
              sheetGrabberVisible: true,
              sheetCornerRadius: 28,
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="records"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.92],
              sheetGrabberVisible: true,
              sheetCornerRadius: 28,
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="shop"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.92],
              sheetGrabberVisible: true,
              sheetCornerRadius: 28,
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen name="pro" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
