import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { registerAdHost } from '@/services/ads';
import { useT } from '@/i18n';
import { Press, T } from './components';
import { color, font, radius, space } from './tokens';

const LENGTH = 5;

// Sadece geliştirme: AdMob bağlanana kadar ödüllü reklamın yerine geçen sahte ekran.
// Akış (ödül, iptal) gerçeğiyle aynı; süre dolmadan kapatılırsa ödül verilmez.
export function AdHost() {
  const t = useT();
  const [left, setLeft] = useState<number | null>(null);
  const done = useRef<((w: boolean) => void) | null>(null);

  useEffect(() => {
    registerAdHost((cb) => {
      done.current = cb;
      setLeft(LENGTH);
    });
    return () => registerAdHost(null);
  }, []);

  useEffect(() => {
    if (left === null || left <= 0) return;
    const id = setTimeout(() => setLeft((v) => (v === null ? null : v - 1)), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const close = () => {
    const ok = left !== null && left <= 0;
    setLeft(null);
    done.current?.(ok);
    done.current = null;
  };

  // Modal: alttan açılan sayfaların (formSheet) da üstünde görünsün
  return (
    <Modal visible={left !== null} animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.root}>
        <View style={styles.badge}>
          <T v="label" style={{ color: color.accentInk }}>
            {t('testAd')}
          </T>
        </View>
        <Ionicons name="play-circle" size={72} color="rgba(255,255,255,0.85)" />
        <T v="heading" muted style={{ textAlign: 'center' }}>
          {t('adPlaceholder')}
        </T>
        <Press label={t('back')} onPress={close} style={styles.close}>
          {left !== null && left > 0 ? (
            <T v="heading" style={{ fontFamily: font.bold, fontVariant: ['tabular-nums'] }}>
              {left}
            </T>
          ) : (
            <Ionicons name="close" size={22} color={color.text} />
          )}
        </Press>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05060B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xxl,
  },
  badge: {
    paddingHorizontal: 10,
    height: 24,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.gold,
  },
  close: {
    position: 'absolute',
    top: 56,
    right: space.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
