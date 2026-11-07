import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRIVACY_URL, TERMS_URL } from '@/config';
import { useT } from '@/i18n';
import { ThemePreview } from '@/render/ThemePreview';
import { getTheme } from '@/render/themes';
import { PRO_PRODUCTS, buyPro, priceOf, restorePurchases, type ProProduct } from '@/services/purchases';
import { PRO_GIFT } from '@/state/store';
import { useIsPro, useProgress } from '@/state/store';
import { IconButton, Press, T } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];
const GOLD = '#FFC15E';
const HERO = 280;

export default function Pro() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pro = useIsPro();
  const state = useProgress().pro;
  const [plan, setPlan] = useState<ProProduct>(PRO_PRODUCTS[1]);
  const [busy, setBusy] = useState(false);
  const hero = getTheme('night');

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    const r = await buyPro(plan);
    setBusy(false);
    if (r.ok) {
      Alert.alert(t('thanks'), t('proActive'));
    } else if (r.reason !== 'cancelled') {
      Alert.alert(t('pro'), r.reason === 'unavailable' ? t('purchaseUnavailable') : t('purchaseFailed'));
    }
  };

  const restore = async () => {
    const r = await restorePurchases();
    Alert.alert(t('restore'), r.ok ? (r.restored ? t('thanks') : t('restoredNone')) : t('purchaseUnavailable'));
  };

  const perks: { icon: IconName; title: string; sub: string }[] = [
    { icon: 'ban', title: t('perkNoAds'), sub: t('perkNoAdsSub') },
    { icon: 'heart', title: t('perkFreeLife'), sub: t('perkFreeLifeSub') },
    { icon: 'gift', title: t('perkWeekly', { n: PRO_GIFT }), sub: t('perkWeeklySub') },
    { icon: 'color-palette', title: t('perkSkies'), sub: t('perkSkiesSub') },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.close, { top: insets.top + space.sm }]}>
        <IconButton icon="close" label={t('back')} size={38} onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 0,
          paddingHorizontal: space.lg,
          paddingBottom: insets.bottom + space.xl,
          gap: space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* sahne içerikle birlikte kayar, metin üstüne binmez */}
        <View style={[styles.hero, { width, marginHorizontal: -space.lg }]}>
          <ThemePreview theme={hero} width={width} height={HERO} floors={4} towerAt={0.5} />
          <LinearGradient
            colors={['rgba(11,15,26,0)', 'rgba(11,15,26,0.55)', color.bg]}
            locations={[0.35, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <Animated.View entering={FadeInUp.duration(420)} style={{ marginTop: -70, alignItems: 'center', gap: 6 }}>
          <View style={styles.gem}>
            <Ionicons name="diamond" size={24} color="#2A1A05" />
          </View>
          <T v="display" style={{ fontSize: 34, lineHeight: 40, textAlign: 'center' }}>
            Plumbline{' '}
            <T v="display" style={{ fontSize: 34, lineHeight: 40, color: GOLD }}>
              Pro
            </T>
          </T>
          <T v="body" muted style={{ textAlign: 'center' }}>
            {t('proTagline')}
          </T>
        </Animated.View>

        <View style={styles.perks}>
          {perks.map((pk, i) => (
            <Animated.View key={pk.icon} entering={FadeInDown.delay(100 + i * 70)} style={styles.perk}>
              <View style={styles.perkIcon}>
                <Ionicons name={pk.icon} size={18} color={GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="heading" style={{ fontSize: 15 }}>
                  {pk.title}
                </T>
                <T v="caption" faint>
                  {pk.sub}
                </T>
              </View>
            </Animated.View>
          ))}
        </View>

        {pro && state ? (
          <View style={[styles.plan, styles.planOn]}>
            <Ionicons name="checkmark-circle" size={22} color={GOLD} />
            <View style={{ flex: 1 }}>
              <T v="heading">{t('proActive')}</T>
              <T v="caption" muted>
                {state.until === null
                  ? t('proForever')
                  : t('proUntil', { date: new Date(state.until).toLocaleDateString(t.locale) })}
              </T>
            </View>
          </View>
        ) : (
          <>
            <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
              {PRO_PRODUCTS.map((pr) => {
                const on = pr.id === plan.id;
                return (
                  <Press
                    key={pr.id}
                    label={t(`plan.${pr.plan}` as 'plan.weekly')}
                    onPress={() => setPlan(pr)}
                    style={[styles.plan, on && styles.planOn]}
                  >
                    <View style={[styles.radio, on && { borderColor: GOLD }]}>
                      {on && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <T v="heading">{t(`plan.${pr.plan}` as 'plan.weekly')}</T>
                        {pr.badge && (
                          <View style={[styles.tag, pr.badge === 'best' && { backgroundColor: color.mint }]}>
                            <T v="caption" style={styles.tagText}>
                              {pr.badge === 'best' ? t('bestValue') : t('popular')}
                            </T>
                          </View>
                        )}
                      </View>
                      <T v="caption" faint>
                        {t(`per.${pr.plan}` as 'per.weekly')}
                      </T>
                    </View>
                    <T v="number" style={{ fontSize: 18 }}>
                      {priceOf(pr)}
                    </T>
                  </Press>
                );
              })}
            </View>

            <Press label={t('proCta')} onPress={buy} style={styles.cta}>
              <LinearGradient
                colors={['#FFD88A', GOLD, '#E9A93B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {busy ? (
                <ActivityIndicator color="#2A1A05" />
              ) : (
                <T v="heading" style={{ color: '#2A1A05', fontFamily: font.bold, fontSize: 17 }}>
                  {t('proCta')} · {priceOf(plan)}
                </T>
              )}
            </Press>
          </>
        )}

        <View style={styles.links}>
          <Press label={t('restore')} onPress={restore} hitSlop={6}>
            <T v="caption" muted style={styles.link}>
              {t('restore')}
            </T>
          </Press>
          <T v="caption" faint>
            ·
          </T>
          <Press label={t('terms')} onPress={() => Linking.openURL(TERMS_URL)} hitSlop={6}>
            <T v="caption" muted style={styles.link}>
              {t('terms')}
            </T>
          </Press>
          <T v="caption" faint>
            ·
          </T>
          <Press label={t('privacyPolicy')} onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={6}>
            <T v="caption" muted style={styles.link}>
              {t('privacyPolicy')}
            </T>
          </Press>
        </View>
        <T v="caption" faint style={{ textAlign: 'center', fontSize: 11, lineHeight: 16 }}>
          {t('subsNote')}
        </T>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  hero: { height: HERO },
  close: { position: 'absolute', right: space.lg, zIndex: 2 },
  gem: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 10,
    marginBottom: 6,
  },
  perks: { gap: space.sm, padding: space.lg, borderRadius: radius.xl, backgroundColor: color.surface },
  perk: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  perkIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,193,94,0.12)',
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.border,
  },
  planOn: { borderColor: GOLD, backgroundColor: 'rgba(255,193,94,0.08)' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD },
  tag: { paddingHorizontal: 8, height: 20, borderRadius: 10, justifyContent: 'center', backgroundColor: GOLD },
  tagText: { color: '#2A1A05', fontFamily: font.bold, fontSize: 10, letterSpacing: 0.3 },
  cta: {
    height: 58,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  link: { textDecorationLine: 'underline' },
});
