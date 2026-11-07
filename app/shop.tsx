import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { ThemePreview } from '@/render/ThemePreview';
import { getTheme } from '@/render/themes';
import { rewardedReady, showRewarded } from '@/services/ads';
import {
  STARTER,
  TOKEN_PACKS,
  buyStarter,
  buyTokens,
  priceOf,
  restorePurchases,
  type TokenPack,
} from '@/services/purchases';
import { CRANES, SKINS, type CraneColor, type Skin } from '@/state/cosmetics';
import {
  AD_TOKENS,
  STARTER_TOKENS,
  adTokensLeft,
  buyCosmetic,
  grantAdTokens,
  owns,
  updateSettings,
  useIsPro,
  useProgress,
  useSettings,
} from '@/state/store';
import { Coin, IconButton, Press, Segmented, T } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';

type Tab = 'tokens' | 'style';

export default function Shop() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { tab: initial } = useLocalSearchParams<{ tab?: string }>();
  const p = useProgress();
  const pro = useIsPro();
  const settings = useSettings();
  const theme = getTheme(settings.theme);
  const [tab, setTab] = useState<Tab>(initial === 'style' ? 'style' : 'tokens');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const adsLeft = adTokensLeft(p);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1700);
  };

  const fail = (reason: string) => {
    if (reason === 'cancelled') return;
    Alert.alert(t('shopTitle'), reason === 'unavailable' ? t('purchaseUnavailable') : t('purchaseFailed'));
  };

  const buy = async (pack: TokenPack) => {
    if (busy) return;
    setBusy(pack.id);
    const r = await buyTokens(pack);
    setBusy(null);
    if (r.ok) flash(t('tokensAdded', { n: pack.tokens }));
    else fail(r.reason);
  };

  const starter = async () => {
    if (busy) return;
    setBusy(STARTER.id);
    const r = await buyStarter();
    setBusy(null);
    if (r.ok) flash(t('tokensAdded', { n: STARTER_TOKENS }));
    else fail(r.reason);
  };

  const watchAd = async () => {
    if (busy || adsLeft <= 0) return;
    if (!rewardedReady()) {
      Alert.alert(t('freeTokens'), t('adNotReady'));
      return;
    }
    setBusy('ad');
    const ok = await showRewarded();
    setBusy(null);
    if (ok) {
      const n = grantAdTokens();
      if (n) flash(t('tokensAdded', { n }));
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
          <T v="title">{t('dockShop')}</T>
          <Press label={t('balance')} onPress={() => setTab('tokens')} style={styles.balance}>
            <Coin size={16} />
            <T v="heading" style={{ fontVariant: ['tabular-nums'] }}>
              {p.tokens.toLocaleString(t.locale)}
            </T>
          </Press>
        </View>
        <IconButton icon="close" label={t('back')} size={38} onPress={() => router.back()} />
      </View>

      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { key: 'tokens', label: t('tabTokens') },
            { key: 'style', label: t('tabStyle') },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.lg }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'tokens' ? (
          <Animated.View key="tokens" entering={FadeIn.duration(200)} style={{ gap: space.lg }}>
            <T v="body" muted style={{ fontSize: 14, lineHeight: 20 }}>
              {t('shopHint')}
            </T>

            {!p.starter && (
              <Press label={t('starterTitle')} onPress={starter} style={styles.starter}>
                <LinearGradient
                  colors={['#5A2E1A', '#2A1B2E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.starterArt}>
                  <ThemePreview theme={theme} width={86} height={100} floors={3} skin="copper" />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="heading">{t('starterTitle')}</T>
                  <T v="caption" muted style={{ lineHeight: 16 }}>
                    {t('starterSub', { n: STARTER_TOKENS })}
                  </T>
                  <View style={[styles.price, styles.priceSmall, { backgroundColor: '#E9A06A' }]}>
                    {busy === STARTER.id ? (
                      <ActivityIndicator color={color.accentInk} size="small" />
                    ) : (
                      <T v="heading" style={styles.priceText}>
                        {priceOf(STARTER)}
                      </T>
                    )}
                  </View>
                </View>
              </Press>
            )}

            <View style={[styles.adRow]}>
              <View style={[styles.adIcon]}>
                <Ionicons name="play" size={18} color={color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="heading" style={{ fontSize: 15 }}>
                  {t('watchForTokens', { n: AD_TOKENS })}
                </T>
                <T v="caption" faint>
                  {adsLeft > 0 ? t('adsLeftToday', { n: adsLeft }) : t('comeBackTomorrow')}
                </T>
              </View>
              <Press
                label={t('freeTokens')}
                disabled={adsLeft <= 0}
                onPress={watchAd}
                style={[styles.adBtn, { backgroundColor: theme.accent }]}
              >
                {busy === 'ad' ? (
                  <ActivityIndicator color={color.accentInk} size="small" />
                ) : (
                  <T v="caption" style={{ color: color.accentInk, fontFamily: font.bold }}>
                    {t('freeTokens')}
                  </T>
                )}
              </Press>
            </View>

            <View style={styles.grid}>
              {TOKEN_PACKS.map((pack, i) => (
                <Animated.View key={pack.id} entering={FadeInDown.delay(i * 60).duration(320)} style={styles.cell}>
                  <Press
                    label={`${pack.tokens} ${t('tokens')}`}
                    onPress={() => buy(pack)}
                    style={[styles.pack, pack.badge && { borderColor: theme.accent }]}
                  >
                    {pack.badge && (
                      <View
                        style={[styles.badge, { backgroundColor: pack.badge === 'best' ? color.gold : theme.accent }]}
                      >
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
                        <T v="heading" style={styles.priceText}>
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
          </Animated.View>
        ) : (
          <Animated.View key="style" entering={FadeIn.duration(200)} style={{ gap: space.lg }}>
            <T v="label" faint>
              {t('skinsTitle')}
            </T>
            <View style={styles.grid}>
              {SKINS.map((sk, i) => (
                <Animated.View key={sk.id} entering={FadeInDown.delay(i * 40).duration(300)} style={styles.cell}>
                  <SkinCard
                    skin={sk}
                    owned={owns(p, sk)}
                    inUse={settings.skin === sk.key}
                    tokens={p.tokens}
                    onUse={() => updateSettings({ skin: sk.key })}
                    onBuy={() => {
                      if (buyCosmetic(sk)) updateSettings({ skin: sk.key });
                      else Alert.alert(t('tabStyle'), t('notEnoughTokens'));
                    }}
                    onPro={() => router.push('/pro')}
                    onStarter={() => setTab('tokens')}
                  />
                </Animated.View>
              ))}
            </View>

            <T v="label" faint style={{ marginTop: space.sm }}>
              {t('cranesTitle')}
            </T>
            <View style={{ gap: space.sm }}>
              {CRANES.map((cr) => (
                <CraneRow
                  key={cr.id}
                  crane={cr}
                  themeCrane={theme.crane}
                  owned={owns(p, cr)}
                  inUse={settings.crane === cr.key}
                  accent={theme.accent}
                  onUse={() => updateSettings({ crane: cr.key })}
                  onBuy={() => {
                    if (buyCosmetic(cr)) updateSettings({ crane: cr.key });
                    else Alert.alert(t('tabStyle'), t('notEnoughTokens'));
                  }}
                />
              ))}
            </View>
          </Animated.View>
        )}
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

function SkinCard({
  skin,
  owned,
  inUse,
  tokens,
  onUse,
  onBuy,
  onPro,
  onStarter,
}: {
  skin: Skin;
  owned: boolean;
  inUse: boolean;
  tokens: number;
  onUse: () => void;
  onBuy: () => void;
  onPro: () => void;
  onStarter: () => void;
}) {
  const t = useT();
  const theme = getTheme(useSettings().theme);
  const { width } = useWindowDimensions();
  const w = Math.floor((width - space.lg * 2 - space.md) / 2) - 3;
  const u = skin.unlock;
  const action = owned ? onUse : 'tokens' in u ? onBuy : 'pro' in u ? onPro : onStarter;

  return (
    <Press
      label={t(`skin.${skin.key}` as 'skin.classic')}
      onPress={inUse ? undefined : action}
      style={[styles.skin, inUse && { borderColor: theme.accent }]}
    >
      <View style={styles.skinArt}>
        <ThemePreview theme={theme} width={w} height={130} floors={3} skin={skin.key} />
        {inUse && (
          <View style={[styles.check, { backgroundColor: theme.accent }]}>
            <Ionicons name="checkmark" size={14} color={color.accentInk} />
          </View>
        )}
      </View>
      <View style={styles.skinFoot}>
        <T v="caption" numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 13, flex: 1 }}>
          {t(`skin.${skin.key}` as 'skin.classic')}
        </T>
        {inUse ? (
          <T v="caption" style={{ color: theme.accent, fontFamily: font.semibold }}>
            {t('inUse')}
          </T>
        ) : owned ? (
          <T v="caption" muted style={{ fontFamily: font.semibold }}>
            {t('use')}
          </T>
        ) : 'tokens' in u ? (
          <View style={[styles.cost, tokens < u.tokens && { opacity: 0.6 }]}>
            <Coin size={13} />
            <T v="caption" style={{ fontFamily: font.bold }}>
              {u.tokens}
            </T>
          </View>
        ) : 'pro' in u ? (
          <View style={[styles.cost, { backgroundColor: color.gold }]}>
            <Ionicons name="diamond" size={11} color="#2A1A05" />
            <T v="caption" style={{ fontFamily: font.black, color: '#2A1A05', fontSize: 11 }}>
              PRO
            </T>
          </View>
        ) : (
          <T v="caption" faint>
            {t('starterOnly')}
          </T>
        )}
      </View>
    </Press>
  );
}

function CraneRow({
  crane,
  themeCrane,
  owned,
  inUse,
  accent,
  onUse,
  onBuy,
}: {
  crane: CraneColor;
  themeCrane: string;
  owned: boolean;
  inUse: boolean;
  accent: string;
  onUse: () => void;
  onBuy: () => void;
}) {
  const t = useT();
  const u = crane.unlock;
  return (
    <Press
      label={t(`crane.${crane.key}` as 'crane.red')}
      onPress={inUse ? undefined : owned ? onUse : onBuy}
      style={[styles.craneRow, inUse && { borderColor: accent }]}
    >
      <View style={[styles.swatch, { backgroundColor: crane.color ?? themeCrane }]}>
        <View style={[styles.swatchBar, { backgroundColor: crane.dark ?? 'rgba(0,0,0,0.25)' }]} />
      </View>
      <T v="body" style={{ flex: 1, fontSize: 15 }}>
        {t(`crane.${crane.key}` as 'crane.red')}
      </T>
      {inUse ? (
        <Ionicons name="checkmark-circle" size={22} color={accent} />
      ) : owned ? (
        <T v="caption" muted style={{ fontFamily: font.semibold }}>
          {t('use')}
        </T>
      ) : 'tokens' in u ? (
        <View style={styles.cost}>
          <Coin size={13} />
          <T v="caption" style={{ fontFamily: font.bold }}>
            {u.tokens}
          </T>
        </View>
      ) : null}
    </Press>
  );
}

// paket büyüdükçe üst üste binen jetonlar
function CoinStack({ count }: { count: number }) {
  return (
    <View style={{ height: 44, width: 64, marginBottom: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ position: 'absolute', bottom: i * 5, left: 16 + (i % 2 ? 5 : i ? -5 : 0) }}>
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
  starter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(233,160,106,0.5)',
  },
  starterArt: { width: 86, height: 100, borderRadius: radius.md, overflow: 'hidden' },
  adRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  adIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,193,94,0.14)',
  },
  adBtn: {
    paddingHorizontal: 14,
    height: 36,
    minWidth: 92,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  cell: { width: '48.4%' },
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
  priceSmall: { marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: space.lg, height: 34 },
  priceText: { color: color.accentInk, fontFamily: font.bold, fontSize: 15 },
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
  skin: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: color.surface,
  },
  skinArt: { height: 130, overflow: 'hidden' },
  skinFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    backgroundColor: color.surfaceStrong,
  },
  craneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    paddingRight: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: color.surface,
  },
  swatch: { width: 40, height: 28, borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
  swatchBar: { height: 9 },
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
