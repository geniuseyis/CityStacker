import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Difficulty } from '@/engine';
import { useT } from '@/i18n';
import { THEMES, isUnlocked } from '@/render/themes';
import { resetProgress, updateSettings, useProgress, useSettings } from '@/state/store';
import { IconButton, Press, Segmented, T, Toggle } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';

export default function SettingsScreen() {
  const t = useT();
  const s = useSettings();
  const p = useProgress();
  const insets = useSafeAreaInsets();

  const confirmReset = () =>
    Alert.alert(t('resetStats'), t('resetConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), style: 'destructive', onPress: resetProgress },
    ]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <T v="title">{t('settings')}</T>
        <IconButton icon="close" label={t('back')} size={38} onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
      >
        <Section title={t('theme')}>
          <View style={styles.themes}>
            {THEMES.map((th) => {
              const open = isUnlocked(th, p.bestFloors);
              const on = s.theme === th.key;
              return (
                <Press
                  key={th.key}
                  label={t(`theme.${th.key}` as 'theme.dusk')}
                  disabled={!open}
                  onPress={() => updateSettings({ theme: th.key })}
                  style={[styles.themeCard, on && { borderColor: th.accent }]}
                >
                  <View style={styles.swatch}>
                    <View style={{ flex: 1, backgroundColor: th.skyLow[0] }} />
                    <View style={{ flex: 1, backgroundColor: th.skyLow[1] }} />
                    <View style={[styles.swatchBlock, { backgroundColor: th.blocks[0].face }]} />
                    {!open && (
                      <View style={styles.lock}>
                        <Ionicons name="lock-closed" size={16} color={color.text} />
                      </View>
                    )}
                  </View>
                  <T v="caption" numberOfLines={1} style={{ fontFamily: on ? font.bold : font.medium }}>
                    {t(`theme.${th.key}` as 'theme.dusk')}
                  </T>
                  {!open && (
                    <T v="caption" faint numberOfLines={1} style={{ fontSize: 10 }}>
                      {t('unlockAt', { n: th.unlockFloors })}
                    </T>
                  )}
                </Press>
              );
            })}
          </View>
        </Section>

        <Section title={t('difficulty')}>
          <Segmented<Difficulty>
            value={s.difficulty}
            onChange={(difficulty) => updateSettings({ difficulty })}
            options={[
              { key: 'easy', label: t('easy') },
              { key: 'normal', label: t('normal') },
              { key: 'hard', label: t('hard') },
            ]}
          />
        </Section>

        <Section>
          <View style={styles.group}>
            <Row icon="volume-high-outline" label={t('sound')}>
              <Toggle label={t('sound')} value={s.sound} onChange={(sound) => updateSettings({ sound })} />
            </Row>
            <Row icon="musical-notes-outline" label={t('music')}>
              <Toggle label={t('music')} value={s.music} onChange={(music) => updateSettings({ music })} />
            </Row>
            <Row icon="phone-portrait-outline" label={t('haptics')}>
              <Toggle label={t('haptics')} value={s.haptics} onChange={(haptics) => updateSettings({ haptics })} />
            </Row>
            <Row icon="accessibility-outline" label={t('reducedMotion')} last>
              <Toggle
                label={t('reducedMotion')}
                value={s.reducedMotion}
                onChange={(reducedMotion) => updateSettings({ reducedMotion })}
              />
            </Row>
          </View>
        </Section>

        <Section title={t('language')}>
          <Segmented<'sys' | 'tr' | 'en'>
            value={s.lang ?? 'sys'}
            onChange={(k) => updateSettings({ lang: k === 'sys' ? null : k })}
            options={[
              { key: 'sys', label: t('system') },
              { key: 'tr', label: 'Türkçe' },
              { key: 'en', label: 'English' },
            ]}
          />
        </Section>

        <Section title={t('privacy')}>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
              <Ionicons name="shield-checkmark-outline" size={20} color={color.mint} />
              <T v="body" muted style={{ flex: 1 }}>
                {t('privacyText')}
              </T>
            </View>
          </View>
        </Section>

        <Press label={t('resetStats')} onPress={confirmReset} style={styles.danger}>
          <Ionicons name="trash-outline" size={18} color={color.danger} />
          <T v="heading" style={{ color: color.danger }}>
            {t('resetStats')}
          </T>
        </Press>

        <T v="caption" faint style={{ textAlign: 'center' }}>
          {t('version')} {Constants.expoConfig?.version}
        </T>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      {title && (
        <T v="label" faint style={{ marginLeft: 4 }}>
          {title}
        </T>
      )}
      {children}
    </View>
  );
}

function Row({
  icon,
  label,
  children,
  last,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Ionicons name={icon} size={20} color={color.textMuted} />
      <T v="body" style={{ flex: 1 }}>
        {label}
      </T>
      {children}
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
  themes: { flexDirection: 'row', gap: space.sm },
  themeCard: {
    flex: 1,
    padding: 6,
    paddingBottom: space.sm,
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  swatch: { height: 64, borderRadius: 10, overflow: 'hidden' },
  swatchBlock: {
    position: 'absolute',
    bottom: 0,
    left: '35%',
    width: '30%',
    height: '55%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  lock: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 56,
    backgroundColor: color.surface,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  card: { padding: space.lg, borderRadius: radius.lg, backgroundColor: color.surface },
  danger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,93,108,0.35)',
  },
});
