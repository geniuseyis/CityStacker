import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGame, type GameState } from '@/engine';
import { useT } from '@/i18n';
import { GameCanvas } from '@/render/GameCanvas';
import { getTheme } from '@/render/themes';
import { craneByKey } from '@/state/cosmetics';
import { dailySeed, todayKey } from '@/state/daily';
import { hasClaimable, useIsPro, useProgress, useSettings } from '@/state/store';
import { Button, Pill, Press, T } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';
import { WEATHER_ICON } from '@/ui/weather';

type Mode = 'endless' | 'daily' | 'ghost';
type IonName = ComponentProps<typeof Ionicons>['name'];

export default function Home() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const progress = useProgress();
  const pro = useIsPro();
  const theme = getTheme(settings.theme);
  const crane = craneByKey(settings.crane);
  const game = useRef<GameState>(createGame(20261106, 'normal', { weather: 'clear' }));
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
  const dailyWeather = useMemo(() => createGame(dailySeed(today), 'normal').weather, [today]);
  const dailyBest = progress.daily?.date === today ? progress.daily.best : 0;
  const best = progress.best[settings.difficulty];
  const ghost = progress.ghosts[settings.difficulty];
  const fmt = (n: number) => n.toLocaleString(t.locale);
  const name = Constants.expoConfig?.name ?? 'Plumbline';
  const badge = hasClaimable(progress);
  const canPlay = mode !== 'ghost' || !!ghost;

  return (
    <View style={styles.root}>
      {/* vitrin sahnesi ekranın üst kısmına sığar, alt panel kuleyi örtmez */}
      <GameCanvas
        game={game}
        theme={theme}
        skin={settings.skin}
        crane={crane}
        demo
        paused={!focused}
        reducedMotion={settings.reducedMotion}
        fit={0.52}
        fitTop={insets.top + 36}
      />

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(11,15,26,0)', 'rgba(11,15,26,0.75)', 'rgba(11,15,26,0.98)']}
        locations={[0, 0.25, 0.5]}
        style={styles.scrim}
      />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Press label={`${fmt(progress.tokens)} ${t('tokens')}`} onPress={() => router.push('/shop')}>
          <Pill coin text={fmt(progress.tokens)} plus />
        </Press>
        {pro ? (
          <View style={styles.proBadge} accessibilityLabel={t('proActive')}>
            <Ionicons name="diamond" size={12} color="#2A1A05" />
            <T v="caption" style={{ color: '#2A1A05', fontFamily: font.black, letterSpacing: 0.6 }}>
              PRO
            </T>
          </View>
        ) : (
          <Press label={t('pro')} onPress={() => router.push('/pro')} style={styles.proBtn}>
            <Ionicons name="diamond" size={16} color={color.gold} />
            <T v="caption" style={{ color: color.gold, fontFamily: font.black, letterSpacing: 0.6 }}>
              PRO
            </T>
          </Press>
        )}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
        <Animated.View entering={FadeIn.duration(600)}>
          <T v="label" style={{ color: theme.accent }}>
            {t('best')} · {fmt(best)}
          </T>
          <T v="display" style={styles.word} accessibilityRole="header">
            {name}
            <T v="display" style={{ color: theme.accent }}>
              .
            </T>
          </T>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.modes}>
          <ModeCard
            active={mode === 'endless'}
            icon={<Ionicons name="infinite" size={18} color={mode === 'endless' ? color.accentInk : color.text} />}
            title={t('endless')}
            sub={`${t(settings.difficulty)} · ${progress.bestFloors} ${t('floors').toLowerCase()}`}
            onPress={() => setMode('endless')}
            accent={theme.accent}
          />
          <ModeCard
            active={mode === 'daily'}
            icon={
              <MaterialCommunityIcons
                name={WEATHER_ICON[dailyWeather]}
                size={18}
                color={mode === 'daily' ? color.accentInk : color.text}
              />
            }
            title={t('daily')}
            sub={dailyBest ? `${t('today')} · ${fmt(dailyBest)}` : t(`weather.${dailyWeather}` as 'weather.clear')}
            onPress={() => setMode('daily')}
            accent={theme.accent}
          />
          <ModeCard
            active={mode === 'ghost'}
            icon={
              <MaterialCommunityIcons name="ghost" size={18} color={mode === 'ghost' ? color.accentInk : color.text} />
            }
            title={t('ghost')}
            sub={ghost ? `${ghost.floors} ${t('floors').toLowerCase()}` : t('ghostLocked')}
            onPress={() => setMode('ghost')}
            accent={theme.accent}
            dim={!ghost}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Button
            title={t('play')}
            icon="play"
            disabled={!canPlay}
            onPress={() => router.push({ pathname: '/play', params: { mode } })}
            style={{ backgroundColor: theme.accent, shadowColor: theme.accent }}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(500)} style={styles.dock}>
          <DockItem icon="gift-outline" label={t('dockDaily')} badge={badge} onPress={() => router.push('/daily')} />
          <DockItem icon="bag-handle-outline" label={t('dockShop')} onPress={() => router.push('/shop')} />
          <DockItem icon="trophy-outline" label={t('dockRecords')} onPress={() => router.push('/records')} />
          <DockItem icon="settings-outline" label={t('dockSettings')} onPress={() => router.push('/settings')} />
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
  dim,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
  accent: string;
  dim?: boolean;
}) {
  return (
    <Press
      onPress={onPress}
      label={title}
      style={[
        styles.mode,
        active && { borderColor: accent, backgroundColor: 'rgba(255,255,255,0.09)' },
        dim && !active && { opacity: 0.6 },
      ]}
    >
      <View style={[styles.modeIcon, active && { backgroundColor: accent }]}>{icon}</View>
      <T v="heading" numberOfLines={1} style={{ fontSize: 15 }}>
        {title}
      </T>
      <T v="caption" muted numberOfLines={2} style={{ fontSize: 11, lineHeight: 15 }}>
        {sub}
      </T>
    </Press>
  );
}

function DockItem({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: IonName;
  label: string;
  onPress: () => void;
  badge?: boolean;
}) {
  return (
    <Press label={label} onPress={onPress} style={styles.dockItem}>
      <View>
        <Ionicons name={icon} size={22} color={color.text} />
        {badge && <View style={styles.dot} />}
      </View>
      <T v="caption" muted style={{ fontSize: 11 }}>
        {label}
      </T>
    </Press>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  proBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(11,15,26,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,193,94,0.45)',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 28,
    alignSelf: 'center',
    borderRadius: 14,
    backgroundColor: color.gold,
  },
  scrim: { ...StyleSheet.absoluteFill, top: '44%' },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, gap: space.md },
  word: { marginTop: space.xs, fontFamily: font.black },
  modes: { flexDirection: 'row', gap: space.sm },
  mode: {
    flex: 1,
    padding: space.md,
    paddingRight: space.sm,
    gap: 2,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    minHeight: 104,
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
  dock: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: space.xs,
  },
  dockItem: { alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: space.md },
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: color.danger,
    borderWidth: 1.5,
    borderColor: color.bg,
  },
});
