import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { getTheme } from '@/render/themes';
import { rewardedReady, showRewarded } from '@/services/ads';
import type { MissionKind } from '@/state/missions';
import {
  AD_TOKENS,
  DAILY_REWARDS,
  PRO_GIFT,
  adTokensLeft,
  claimDaily,
  claimMission,
  claimProGift,
  dailyStatus,
  grantAdTokens,
  missionView,
  proGiftReady,
  useIsPro,
  useProgress,
  useSettings,
} from '@/state/store';
import { Button, Coin, IconButton, Press, T } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';

type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const MISSION_ICON: Record<MissionKind, MciName> = {
  perfectStreak: 'lightning-bolt',
  floorsRun: 'office-building',
  perfects: 'target',
  games: 'gamepad-variant',
  scoreRun: 'star-four-points',
  dailyPlay: 'calendar-star',
  weatherFloors: 'weather-windy',
  ghostBeat: 'ghost',
};

export default function Daily() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const p = useProgress();
  const pro = useIsPro();
  const theme = getTheme(useSettings().theme);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const st = dailyStatus(p);
  const missions = missionView(p);
  const adsLeft = adTokensLeft(p);
  const gift = proGiftReady(p);

  const flash = (n: number) => {
    if (n <= 0) return;
    setToast(`+${n} ${t('tokens').toLowerCase()}`);
    setTimeout(() => setToast(null), 1600);
  };

  const withAd = async (fn: () => void) => {
    if (busy) return;
    if (!rewardedReady()) {
      Alert.alert(t('freeTokens'), t('adNotReady'));
      return;
    }
    setBusy(true);
    const ok = await showRewarded();
    setBusy(false);
    if (ok) fn();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <T v="title">{t('dailyTitle')}</T>
        <IconButton icon="close" label={t('back')} size={38} onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* giriş serisi */}
        <Animated.View entering={FadeInDown.duration(320)} style={styles.card}>
          <View style={styles.cardHead}>
            <MaterialCommunityIcons name="fire" size={20} color={theme.accent} />
            <T v="heading" style={{ flex: 1 }}>
              {t('streakTitle')}
            </T>
            <T v="caption" muted>
              {t('streakDay', { n: st.day })}
            </T>
          </View>
          <T v="caption" faint style={{ lineHeight: 17 }}>
            {t('streakHint')}
          </T>
          <View style={styles.days}>
            {DAILY_REWARDS.map((r, i) => {
              const d = i + 1;
              const done = st.claimedToday ? d <= st.day : d < st.day;
              const today = d === st.day;
              const big = d === 7;
              return (
                <View
                  key={d}
                  style={[
                    styles.day,
                    done && styles.dayDone,
                    today && !st.claimedToday && { borderColor: theme.accent, backgroundColor: theme.accent + '22' },
                    big && styles.dayBig,
                  ]}
                >
                  <T v="caption" faint style={{ fontSize: 10 }}>
                    {d}
                  </T>
                  {done ? <Ionicons name="checkmark" size={16} color={color.mint} /> : <Coin size={big ? 18 : 14} />}
                  <T v="caption" style={{ fontFamily: font.bold, fontSize: 12 }}>
                    {r}
                  </T>
                </View>
              );
            })}
          </View>
          {st.claimable ? (
            <View style={{ gap: space.sm }}>
              <Button
                title={`${t('claim')} +${st.reward}`}
                icon="gift"
                onPress={() => flash(claimDaily(1))}
                style={{ backgroundColor: theme.accent }}
              />
              {rewardedReady() && (
                <Button
                  title={t('claimDouble')}
                  kind="secondary"
                  icon="play-circle-outline"
                  onPress={() => withAd(() => flash(claimDaily(2)))}
                />
              )}
            </View>
          ) : (
            <View style={styles.doneRow}>
              <Ionicons name="time-outline" size={16} color={color.textMuted} />
              <T v="caption" muted>
                {t('comeBackTomorrow')}
              </T>
            </View>
          )}
        </Animated.View>

        {/* Pro hediyesi */}
        {pro && (
          <Animated.View entering={FadeInDown.delay(60).duration(320)} style={[styles.card, styles.proCard]}>
            <LinearGradient
              colors={['#3A2A12', '#1C1530']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.cardHead}>
              <Ionicons name="diamond" size={18} color={color.gold} />
              <T v="heading" style={{ flex: 1 }}>
                {t('proGiftTitle')}
              </T>
            </View>
            {gift ? (
              <Button
                title={`${t('claim')} +${PRO_GIFT}`}
                icon="gift"
                onPress={() => flash(claimProGift() ? PRO_GIFT : 0)}
                style={{ backgroundColor: color.gold }}
              />
            ) : (
              <T v="caption" muted>
                {t('proGiftNext', {
                  date: new Date(p.proGiftAt + 7 * 864e5).toLocaleDateString(t.locale, {
                    day: 'numeric',
                    month: 'long',
                  }),
                })}
              </T>
            )}
          </Animated.View>
        )}

        {/* reklamla jeton */}
        <Animated.View entering={FadeInDown.delay(100).duration(320)} style={[styles.card, styles.row]}>
          <View style={[styles.tile, { backgroundColor: color.gold + '22' }]}>
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
            disabled={adsLeft <= 0 || busy}
            onPress={() => withAd(() => flash(grantAdTokens()))}
            style={[styles.smallBtn, { backgroundColor: theme.accent }]}
          >
            <Coin size={14} />
            <T v="caption" style={{ color: color.accentInk, fontFamily: font.bold }}>
              +{AD_TOKENS}
            </T>
          </Press>
        </Animated.View>

        {/* görevler */}
        <View style={[styles.cardHead, { marginTop: space.sm }]}>
          <T v="label" faint style={{ flex: 1 }}>
            {t('missionsTitle')}
          </T>
          <T v="caption" faint>
            {t('missionsHint')}
          </T>
        </View>
        {missions.map((m, i) => {
          const ratio = Math.min(1, m.progress / m.target);
          return (
            <Animated.View
              key={m.id}
              entering={FadeInDown.delay(140 + i * 60).duration(320)}
              style={[styles.card, styles.row, m.claimed && { opacity: 0.55 }]}
            >
              <View style={[styles.tile, { backgroundColor: color.surfaceStrong }]}>
                <MaterialCommunityIcons name={MISSION_ICON[m.kind]} size={18} color={color.text} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <T v="body" style={{ fontSize: 14, lineHeight: 18 }}>
                  {t(`mission.${m.kind}` as 'mission.games', { n: m.target.toLocaleString(t.locale) })}
                </T>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${ratio * 100}%`, backgroundColor: m.done ? color.mint : theme.accent },
                    ]}
                  />
                </View>
                <T v="caption" faint style={{ fontVariant: ['tabular-nums'] }}>
                  {Math.min(m.progress, m.target).toLocaleString(t.locale)} / {m.target.toLocaleString(t.locale)}
                </T>
              </View>
              {m.claimed ? (
                <Ionicons name="checkmark-circle" size={26} color={color.mint} />
              ) : (
                <Press
                  label={t('claim')}
                  disabled={!m.done}
                  onPress={() => flash(claimMission(m.id))}
                  style={[styles.smallBtn, { backgroundColor: m.done ? color.mint : color.surfaceStrong }]}
                >
                  <Coin size={14} />
                  <T v="caption" style={{ color: m.done ? color.accentInk : color.text, fontFamily: font.bold }}>
                    +{m.reward}
                  </T>
                </Press>
              )}
            </Animated.View>
          );
        })}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bgRaised },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  card: { padding: space.lg, gap: space.md, borderRadius: radius.xl, backgroundColor: color.surface },
  proCard: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,193,94,0.35)' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  days: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  dayDone: { borderColor: 'rgba(124,243,212,0.35)', backgroundColor: 'rgba(124,243,212,0.08)' },
  dayBig: { flex: 1.25 },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radius.pill,
  },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
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
