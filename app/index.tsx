import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGame, type GameState } from '@/engine';
import { useT } from '@/i18n';
import { GameCanvas } from '@/render/GameCanvas';
import { getTheme } from '@/render/themes';
import { todayKey } from '@/state/daily';
import { useProgress, useSettings } from '@/state/store';
import { Button, IconButton, Pill, Press, T } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';

type Mode = 'endless' | 'daily';

export default function Home() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const progress = useProgress();
  const theme = getTheme(settings.theme);
  const game = useRef<GameState>(createGame(20261106, 'normal'));
  const [mode, setMode] = useState<Mode>('endless');
  const [focused, setFocused] = useState(true);

  // oyun ekranındayken vitrin animasyonu dursun
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  const today = todayKey();
  const dailyBest = progress.daily?.date === today ? progress.daily.best : 0;
  const best = progress.best[settings.difficulty];
  const fmt = (n: number) => n.toLocaleString(t.locale);
  const name = Constants.expoConfig?.name ?? 'Plumbline';

  return (
    <View style={styles.root}>
      <GameCanvas game={game} theme={theme} demo paused={!focused} reducedMotion={settings.reducedMotion} />

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(11,15,26,0)', 'rgba(11,15,26,0.55)', 'rgba(11,15,26,0.96)']}
        locations={[0, 0.35, 0.78]}
        style={styles.scrim}
      />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Pill icon="ellipse" text={`${fmt(progress.tokens)}  ${t('tokens')}`} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton icon="trophy-outline" label={t('records')} onPress={() => router.push('/records')} />
          <IconButton icon="settings-outline" label={t('settings')} onPress={() => router.push('/settings')} />
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
        <Animated.View entering={FadeIn.duration(600)}>
          <T v="label" style={{ color: theme.accent }}>
            {t('best')} · {fmt(best)}
          </T>
          <T v="display" style={styles.word} accessibilityRole="header">
            {name.replace(/([a-z])([A-Z])/, '$1\n$2')}
            <T v="display" style={{ color: theme.accent }}>
              .
            </T>
          </T>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.modes}>
          <ModeCard
            active={mode === 'endless'}
            icon="infinite"
            title={t('endless')}
            sub={`${t(settings.difficulty)} · ${t('floors')} ${progress.bestFloors}`}
            onPress={() => setMode('endless')}
            accent={theme.accent}
          />
          <ModeCard
            active={mode === 'daily'}
            icon="calendar-clear-outline"
            title={t('daily')}
            sub={dailyBest ? `${t('today')} · ${fmt(dailyBest)}` : t('dailyHint')}
            onPress={() => setMode('daily')}
            accent={theme.accent}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(500)}>
          <Button
            title={t('play')}
            icon="play"
            onPress={() => router.push({ pathname: '/play', params: { mode } })}
            style={{ backgroundColor: theme.accent, shadowColor: theme.accent }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

function ModeCard({
  active,
  icon,
  title,
  sub,
  onPress,
  accent,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  sub: string;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Press
      onPress={onPress}
      label={title}
      style={[styles.mode, active && { borderColor: accent, backgroundColor: 'rgba(255,255,255,0.09)' }]}
    >
      <View style={[styles.modeIcon, active && { backgroundColor: accent }]}>
        <Ionicons name={icon} size={18} color={active ? color.accentInk : color.text} />
      </View>
      <T v="heading" numberOfLines={1}>
        {title}
      </T>
      <T v="caption" muted numberOfLines={2}>
        {sub}
      </T>
    </Press>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  scrim: { ...StyleSheet.absoluteFill, top: '38%' },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, gap: space.lg },
  word: { marginTop: space.xs, fontFamily: font.black },
  modes: { flexDirection: 'row', gap: space.md },
  mode: {
    flex: 1,
    padding: space.md,
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    minHeight: 112,
  },
  modeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceStrong,
    marginBottom: 6,
  },
});
