import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { OverReason } from '@/engine';
import { useT } from '@/i18n';
import { Button, Coin, Glass, Press, T } from './components';
import { useArmed } from './useArmed';
import { color, font, radius, space } from './tokens';

const SECONDS = 8;

type Props = {
  reason: OverReason;
  floors: number;
  score: number;
  cost: number;
  tokens: number;
  livesLeft: number; // bu oyunda daha kaç hak alınabilir
  free: boolean; // Pro: oyun başına bir ücretsiz hak
  ad: boolean;
  accent: string;
  active: boolean; // mağaza açıkken geri sayım durur
  onBuy: () => void;
  onFree: () => void;
  onAd: () => void;
  onShop: () => void;
  onDecline: () => void;
};

// Kayıptan sonra: kısa geri sayımla "hak al" teklifi. Süre dolarsa ya da
// vazgeçilirse sonuç ekranına geçilir.
export function ContinueOffer(p: Props) {
  const t = useT();
  const armed = useArmed(600);
  const [left, setLeft] = useState(SECONDS);
  const bar = useSharedValue(1);
  const enough = p.tokens >= p.cost;

  useEffect(() => {
    if (!p.active) return;
    bar.value = withTiming(0, { duration: left * 1000, easing: Easing.linear });
    const id = setInterval(() => setLeft((v) => v - 1), 1000);
    return () => {
      clearInterval(id);
      cancelAnimation(bar);
    };
  }, [p.active]); // left bilerek yok: sadece duraklat/devam

  useEffect(() => {
    if (left <= 0) p.onDecline();
  }, [left]); // onDecline her renderda yeni, sadece süre bitince

  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
  const title = t(`reason.${p.reason}` as 'reason.miss');

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={{ width: '100%' }}>
      <Glass strong style={styles.sheet}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={[styles.icon, { backgroundColor: color.danger + '22' }]}>
            <Ionicons name={p.reason === 'collapse' ? 'warning' : 'arrow-down'} size={22} color={color.danger} />
          </View>
          <T v="title" style={{ textAlign: 'center' }}>
            {title}
          </T>
          <T v="caption" faint>
            {p.floors} {t('floors').toLowerCase()} · {p.score.toLocaleString(t.locale)}
          </T>
        </View>

        <View style={styles.track}>
          <Animated.View style={[styles.fill, { backgroundColor: p.accent }, barStyle]} />
        </View>

        {p.free ? (
          <Button
            title={t('continueFree')}
            icon="sparkles"
            onPress={armed(p.onFree)}
            style={{ backgroundColor: p.accent }}
            right={<ProTag />}
          />
        ) : enough ? (
          <Button
            title={t('buyLife')}
            icon="heart"
            onPress={armed(p.onBuy)}
            style={{ backgroundColor: p.accent }}
            right={
              <View style={styles.cost}>
                <Coin size={14} />
                <T v="caption" style={{ color: color.accentInk, fontFamily: font.bold }}>
                  {p.cost}
                </T>
              </View>
            }
          />
        ) : (
          <Button
            title={t('getTokens')}
            icon="add-circle"
            onPress={armed(p.onShop)}
            style={{ backgroundColor: p.accent }}
          />
        )}

        {p.ad && !p.free && (
          <Button title={t('watchAdLife')} kind="secondary" icon="play-circle-outline" onPress={armed(p.onAd)} />
        )}

        <View style={styles.footer}>
          <Press label={t('balance')} onPress={armed(p.onShop)} style={styles.balance} hitSlop={6}>
            <Coin size={16} />
            <T v="caption" style={{ fontFamily: font.semibold, fontVariant: ['tabular-nums'] }}>
              {p.tokens}
            </T>
            <Ionicons name="add" size={14} color={color.textMuted} />
          </Press>
          <T v="caption" faint style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
            {!p.free && !enough ? t('notEnough', { n: p.cost - p.tokens }) : t('livesLeftRun', { n: p.livesLeft })}
          </T>
          <Press label={t('giveUp')} onPress={armed(p.onDecline)} style={styles.decline} hitSlop={6}>
            <T v="caption" muted style={{ fontFamily: font.semibold }}>
              {t('giveUp')}
            </T>
          </Press>
        </View>
      </Glass>
    </Animated.View>
  );
}

function ProTag() {
  return (
    <View style={[styles.cost, { paddingHorizontal: 7 }]}>
      <T v="caption" style={{ color: color.accentInk, fontFamily: font.black, fontSize: 11, letterSpacing: 0.6 }}>
        PRO
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: space.xl, gap: space.lg },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  cost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
  },
  decline: { paddingHorizontal: 10, height: 30, justifyContent: 'center' },
});
