import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { ThemePreview } from '@/render/ThemePreview';
import { getTheme } from '@/render/themes';
import { tapFeedback } from '@/services/feedback';
import { todayKey } from '@/state/daily';
import type { RunEntry } from '@/state/schema';
import { useProgress, useSettings } from '@/state/store';
import { Button, IconButton, T } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';

const HERO_H = 180;

type Filter = 'all' | 'easy' | 'normal' | 'hard' | 'daily';
type IconName = ComponentProps<typeof Ionicons>['name'];

const MEDALS = [
  ['#FFE08A', '#E9A93B'],
  ['#E9EDF5', '#A8B1C2'],
  ['#F2B48A', '#B8703F'],
] as const;

export default function Records() {
  const t = useT();
  const p = useProgress();
  const { theme: themeKey } = useSettings();
  const theme = getTheme(themeKey);
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const heroW = useWindowDimensions().width - space.lg * 2;

  const fmt = (n: number) => n.toLocaleString(t.locale);
  const date = (ts: number) => new Date(ts).toLocaleDateString(t.locale, { day: 'numeric', month: 'short' });

  const runs = useMemo(
    () =>
      p.runs.filter((r) =>
        filter === 'all' ? true : filter === 'daily' ? !!r.daily : !r.daily && r.difficulty === filter
      ),
    [p.runs, filter]
  );

  const best =
    filter === 'all'
      ? Math.max(p.best.easy, p.best.normal, p.best.hard)
      : filter === 'daily'
        ? (runs[0]?.score ?? 0)
        : p.best[filter];
  const today = p.daily?.date === todayKey() ? p.daily.best : 0;

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'easy', label: t('easy') },
    { key: 'normal', label: t('normal') },
    { key: 'hard', label: t('hard') },
    { key: 'daily', label: t('daily') },
  ];

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.sm }}>
      {/* rekor kartı */}
      <Animated.View entering={FadeInDown.duration(380)} style={styles.hero}>
        {/* arka plan: temanın sahnesi, kule sağda; soldan koyulaşan perde metni okutur */}
        <View style={StyleSheet.absoluteFill}>
          <ThemePreview theme={theme} width={heroW} height={HERO_H} floors={4} towerAt={0.8} />
        </View>
        <LinearGradient
          colors={['rgba(11,15,26,0.92)', 'rgba(11,15,26,0.55)', 'rgba(11,15,26,0)']}
          locations={[0, 0.5, 0.78]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1, padding: space.xl, gap: 6, justifyContent: 'center' }}>
          <T v="label" style={{ color: theme.accent }}>
            {t('bestScore')}
          </T>
          <T style={styles.heroNum} numberOfLines={1} adjustsFontSizeToFit>
            {fmt(best)}
          </T>
          <View style={styles.heroMeta}>
            <Meta icon="business" text={`${fmt(p.bestFloors)} ${t('floors').toLowerCase()}`} />
            <Meta icon="flash" text={`${fmt(p.totalPerfects)} ${t('perfects').toLowerCase()}`} />
          </View>
        </View>
      </Animated.View>

      {/* istatistikler */}
      <View style={styles.grid}>
        <Stat icon="game-controller-outline" label={t('games')} value={fmt(p.games)} />
        <Stat icon="layers-outline" label={t('totalFloors')} value={fmt(p.totalFloors)} />
        <Stat icon="calendar-clear-outline" label={t('today')} value={today ? fmt(today) : '—'} />
        <Stat
          icon="trending-up-outline"
          label={t('avgFloors')}
          value={p.games ? (p.totalFloors / p.games).toFixed(1) : '—'}
        />
      </View>

      {/* filtre */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {filters.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (on) return;
                tapFeedback();
                setFilter(f.key);
              }}
              style={[styles.chip, on && { backgroundColor: color.text, borderColor: color.text }]}
            >
              <T
                v="caption"
                style={{ fontFamily: on ? font.bold : font.medium, color: on ? color.bg : color.textMuted }}
              >
                {f.label}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <T v="title">{t('records')}</T>
        <IconButton icon="close" label={t('back')} size={38} onPress={() => router.back()} />
      </View>

      <FlatList
        data={runs}
        keyExtractor={(r, i) => `${r.ts}-${i}`}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.sm }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyArt}>
              <ThemePreview theme={theme} width={120} height={120} floors={1} />
            </View>
            <T v="heading" style={{ textAlign: 'center' }}>
              {t('noRunsTitle')}
            </T>
            <T v="body" muted style={{ textAlign: 'center', fontSize: 14 }}>
              {t('noRuns')}
            </T>
            <Button
              title={t('play')}
              icon="play"
              onPress={() =>
                router.replace({ pathname: '/play', params: { mode: filter === 'daily' ? 'daily' : 'endless' } })
              }
              style={{ backgroundColor: theme.accent, alignSelf: 'stretch', marginTop: space.sm }}
            />
          </View>
        }
        renderItem={({ item, index }) => <RunRow run={item} rank={index} t={t} fmt={fmt} date={date} />}
      />
    </View>
  );
}

function RunRow({
  run,
  rank,
  t,
  fmt,
  date,
}: {
  run: RunEntry;
  rank: number;
  t: ReturnType<typeof useT>;
  fmt: (n: number) => string;
  date: (ts: number) => string;
}) {
  const medal = rank < 3 ? MEDALS[rank] : null;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(rank, 8) * 40).duration(300)} style={styles.item}>
      {medal ? (
        <LinearGradient colors={medal} style={styles.medal}>
          <T style={styles.medalText}>{rank + 1}</T>
        </LinearGradient>
      ) : (
        <View style={styles.rank}>
          <T style={[styles.medalText, { color: color.textFaint }]}>{rank + 1}</T>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <T v="number" style={{ fontSize: 19 }}>
          {fmt(run.score)}
        </T>
        <T v="caption" faint>
          {run.daily ? t('daily') : t(run.difficulty)} · {date(run.ts)}
        </T>
      </View>
      <View style={styles.floors}>
        <Ionicons name="business" size={12} color={color.textMuted} />
        <T v="caption" muted style={{ fontFamily: font.semibold, fontVariant: ['tabular-nums'] }}>
          {run.floors}
        </T>
      </View>
    </Animated.View>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={12} color="rgba(255,255,255,0.8)" />
      <T v="caption" style={{ color: 'rgba(255,255,255,0.85)', fontFamily: font.semibold }}>
        {text}
      </T>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={color.textMuted} />
      <View style={{ flex: 1 }}>
        <T v="number" style={{ fontSize: 18 }} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </T>
        <T v="caption" faint numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {label}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bgRaised },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.md,
  },
  hero: {
    flexDirection: 'row',
    borderRadius: radius.xl,
    overflow: 'hidden',
    height: HERO_H,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
  heroNum: {
    fontFamily: font.black,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -1.5,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 4 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    paddingRight: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  medal: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rank: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.border,
  },
  medalText: { fontFamily: font.black, fontSize: 14, color: '#2A1A05', fontVariant: ['tabular-nums'] },
  floors: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
  },
  empty: { alignItems: 'center', gap: space.sm, paddingTop: space.xl, paddingHorizontal: space.lg },
  emptyArt: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', marginBottom: space.sm },
});
