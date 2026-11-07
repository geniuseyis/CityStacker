import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { getTheme } from '@/render/themes';
import { TOKEN_PACKS, buyTokens, priceOf, restorePurchases, type TokenPack } from '@/services/purchases';
import { useIsPro, useProgress, useSettings } from '@/state/store';
import { Coin, IconButton, Press, T } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';

export default function Shop() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const p = useProgress();
  const pro = useIsPro();
  const theme = getTheme(useSettings().theme);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const buy = async (pack: TokenPack) => {
    if (busy) return;
    setBusy(pack.id);
    const r = await buyTokens(pack);
    setBusy(null);
    if (r.ok) {
      setToast(t('tokensAdded', { n: pack.tokens }));
      setTimeout(() => setToast(null), 1800);
    } else if (r.reason !== 'cancelled') {
      Alert.alert(t('shopTitle'), r.reason === 'unavailable' ? t('purchaseUnavailable') : t('purchaseFailed'));
    }
  };

  const restore = async () => {
    const r = await restorePurchases();
    Alert.alert(t('restore'), r.ok ? (r.restored ? t('thanks') : t('restoredNone')) : t('purchaseUnavailable'));
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ gap: 2 }}>
          <T v="title">{t('shopTitle')}</T>
          <View style={styles.balance}>
            <Coin size={16} />
            <T v="heading" style={{ fontVariant: ['tabular-nums'] }}>
              {p.tokens.toLocaleString(t.locale)}
            </T>
          </View>
        </View>
        <IconButton icon="close" label={t('back')} size={38} onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <T v="body" muted style={{ fontSize: 14, lineHeight: 20 }}>
          {t('shopHint')}
        </T>

        <View style={styles.grid}>
          {TOKEN_PACKS.map((pack, i) => (
            <Animated.View key={pack.id} entering={FadeInDown.delay(i * 60).duration(320)} style={styles.cell}>
              <Press
                label={`${pack.tokens} ${t('tokens')}`}
                onPress={() => buy(pack)}
                style={[styles.pack, pack.badge && { borderColor: theme.accent }]}
              >
                {pack.badge && (
                  <View style={[styles.badge, { backgroundColor: pack.badge === 'best' ? color.gold : theme.accent }]}>
                    <T v="caption" style={styles.badgeText}>
                      {pack.badge === 'best' ? t('bestValue') : t('popular')}
                    </T>
                  </View>
                )}
                <CoinStack count={Math.min(4, 1 + i)} />
                <T style={styles.amount}>{pack.tokens}</T>
                <T v="caption" faint>
                  {pack.bonus ? `${t('bonusPct', { n: pack.bonus })} · ` : ''}
                  {t('tokens')}
                </T>
                <View style={[styles.price, { backgroundColor: theme.accent }]}>
                  {busy === pack.id ? (
                    <ActivityIndicator color={color.accentInk} size="small" />
                  ) : (
                    <T v="heading" style={{ color: color.accentInk, fontFamily: font.bold, fontSize: 15 }}>
                      {priceOf(pack)}
                    </T>
                  )}
                </View>
              </Press>
            </Animated.View>
          ))}
        </View>

        {!pro && (
          <Press label={t('pro')} onPress={() => router.push('/pro')} style={styles.proBanner}>
            <LinearGradient
              colors={['#3A2A12', '#1C1530']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.crown}>
              <Ionicons name="diamond" size={18} color="#2A1A05" />
            </View>
            <View style={{ flex: 1 }}>
              <T v="heading">{t('pro')}</T>
              <T v="caption" muted>
                {t('proBanner')}
              </T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={color.textMuted} />
          </Press>
        )}

        <Press label={t('restore')} onPress={restore} style={styles.restore}>
          <T v="caption" muted style={{ fontFamily: font.semibold }}>
            {t('restore')}
          </T>
        </Press>
        <T v="caption" faint style={{ textAlign: 'center' }}>
          {t('storeNote')}
        </T>
      </ScrollView>

      {toast && (
        <Animated.View entering={ZoomIn.springify()} style={[styles.toast, { bottom: insets.bottom + space.xl }]}>
          <Coin size={18} />
          <T v="heading" style={{ fontSize: 15 }}>
            {toast}
          </T>
        </Animated.View>
      )}
    </View>
  );
}

// paket büyüdükçe üst üste binen jetonlar
function CoinStack({ count }: { count: number }) {
  return (
    <View style={{ height: 44, width: 64, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ position: 'absolute', bottom: i * 6, left: 16 + ((i % 2) * 2 - 1) * (i ? 6 : 0) }}>
          <Coin size={32} />
        </View>
      ))}
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
  },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { flexBasis: '47%', flexGrow: 1 },
  pack: {
    alignItems: 'center',
    paddingTop: space.xl + 10,
    paddingBottom: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.border,
    gap: 2,
  },
  badge: {
    position: 'absolute',
    top: -1,
    paddingHorizontal: 10,
    height: 22,
    justifyContent: 'center',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  badgeText: { color: color.accentInk, fontFamily: font.bold, fontSize: 11, letterSpacing: 0.3 },
  amount: { fontFamily: font.black, fontSize: 28, color: color.text, fontVariant: ['tabular-nums'] },
  price: {
    marginTop: space.md,
    alignSelf: 'stretch',
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,193,94,0.35)',
  },
  crown: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.gold,
  },
  restore: { alignSelf: 'center', paddingVertical: space.sm, paddingHorizontal: space.lg },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: '#1E2438',
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
});
