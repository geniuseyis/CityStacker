import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { useProgress } from '@/state/store';
import { IconButton, T } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';

export default function Records() {
  const t = useT();
  const p = useProgress();
  const insets = useSafeAreaInsets();
  const fmt = (n: number) => n.toLocaleString(t.locale);
  const date = (ts: number) => new Date(ts).toLocaleDateString(t.locale, { day: 'numeric', month: 'short' });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <T v="title">{t('records')}</T>
        <IconButton icon="close" label={t('back')} size={38} onPress={() => router.back()} />
      </View>

      <View style={styles.summary}>
        <Sum label={t('best')} value={fmt(Math.max(p.best.easy, p.best.normal, p.best.hard))} />
        <Sum label={t('floors')} value={fmt(p.bestFloors)} />
        <Sum label={t('games')} value={fmt(p.games)} />
        <Sum label={t('totalFloors')} value={fmt(p.totalFloors)} />
      </View>

      <FlatList
        data={p.runs}
        keyExtractor={(r, i) => `${r.ts}-${i}`}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xl, gap: space.sm }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={36} color={color.textFaint} />
            <T v="body" muted style={{ textAlign: 'center' }}>
              {t('noRuns')}
            </T>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.item, index === 0 && styles.first]}>
            <T style={[styles.rank, index < 3 && { color: color.gold }]}>{index + 1}</T>
            <View style={{ flex: 1 }}>
              <T v="number" style={{ fontSize: 18 }}>
                {fmt(item.score)}
              </T>
              <T v="caption" faint>
                {item.daily ? t('daily') : t(item.difficulty)} · {date(item.ts)}
              </T>
            </View>
            <View style={styles.floors}>
              <Ionicons name="business" size={13} color={color.textMuted} />
              <T v="caption" muted style={{ fontFamily: font.semibold }}>
                {item.floors}
              </T>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function Sum({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sum}>
      <T v="number" style={{ fontSize: 18 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      <T v="caption" faint numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bgRaised },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.sm,
  },
  summary: { flexDirection: 'row', gap: space.sm, padding: space.lg },
  sum: { flex: 1, padding: space.md, borderRadius: radius.md, backgroundColor: color.surface, gap: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  first: { borderWidth: 1, borderColor: 'rgba(255,193,94,0.35)' },
  rank: { width: 22, fontFamily: font.bold, fontSize: 15, color: color.textFaint, fontVariant: ['tabular-nums'] },
  floors: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { alignItems: 'center', gap: space.md, paddingTop: 60, paddingHorizontal: space.xl },
});
