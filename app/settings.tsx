import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Difficulty } from '@/engine';
import { useT } from '@/i18n';
import { ThemePreview } from '@/render/ThemePreview';
import { THEMES, isUnlocked, type SkyTheme } from '@/render/themes';
import { tapFeedback } from '@/services/feedback';
import { restorePurchases } from '@/services/purchases';
import { resetProgress, updateSettings, useIsPro, useProgress, useSettings } from '@/state/store';
import { IconButton, Press, Segmented, T, Toggle } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function SettingsScreen() {
  const t = useT();
  const s = useSettings();
  const p = useProgress();
  const pro = useIsPro();
  const insets = useSafeAreaInsets();
  const active = THEMES.find((th) => th.key === s.theme) ?? THEMES[0];

  const confirmReset = () =>
    Alert.alert(t('resetStats'), t('resetConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), style: 'destructive', onPress: resetProgress },
    ]);

  const restore = async () => {
    const r = await restorePurchases();
    Alert.alert(t('restore'), r.ok ? (r.restored ? t('thanks') : t('restoredNone')) : t('purchaseUnavailable'));
  };

  const diffs: { key: Difficulty; icon: IconName }[] = [
    { key: 'easy', icon: 'leaf-outline' },
    { key: 'normal', icon: 'speedometer-outline' },
    { key: 'hard', icon: 'flame-outline' },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <T v="title">{t('settings')}</T>
        <IconButton icon="close" label={t('back')} size={38} onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pad}>
          <Press label={t('pro')} onPress={() => router.push('/pro')} style={styles.proCard}>
            <LinearGradient
              colors={['#3A2A12', '#1C1530']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.gem}>
              <Ionicons name="diamond" size={18} color="#2A1A05" />
            </View>
            <View style={{ flex: 1 }}>
              <T v="heading">{t('pro')}</T>
              <T v="caption" muted>
                {pro ? t('proActive') : t('proBanner')}
              </T>
            </View>
            <Ionicons
              name={pro ? 'checkmark-circle' : 'chevron-forward'}
              size={20}
              color={pro ? color.gold : color.textMuted}
            />
          </Press>
        </View>

        <Section title={t('theme')} hint={t(`theme.${active.key}` as 'theme.dusk')}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
          >
            {THEMES.map((th) => (
              <ThemeCard
                key={th.key}
                theme={th}
                selected={s.theme === th.key}
                bestFloors={p.bestFloors}
                pro={pro}
                label={t(`theme.${th.key}` as 'theme.dusk')}
                lockLabel={t('floorsLeft', { n: Math.max(0, th.unlockFloors - p.bestFloors) })}
                selectedLabel={t('selected')}
                openLabel={t('tapToUse')}
                onPress={() => updateSettings({ theme: th.key })}
              />
            ))}
          </ScrollView>
        </Section>

        <Section title={t('difficulty')}>
          <View style={styles.pad}>
            <View style={styles.diffs}>
              {diffs.map((d) => {
                const on = s.difficulty === d.key;
                return (
                  <Pressable
                    key={d.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t(d.key)}
                    onPress={() => {
                      if (on) return;
                      tapFeedback();
                      updateSettings({ difficulty: d.key });
                    }}
                    style={[
                      styles.diff,
                      on && { borderColor: active.accent, backgroundColor: 'rgba(255,255,255,0.08)' },
                    ]}
                  >
                    <View style={[styles.diffIcon, on && { backgroundColor: active.accent }]}>
                      <Ionicons name={d.icon} size={18} color={on ? color.accentInk : color.textMuted} />
                    </View>
                    <T v="heading" style={{ fontSize: 15 }}>
                      {t(d.key)}
                    </T>
                    <T v="caption" faint style={{ lineHeight: 16 }}>
                      {t(`${d.key}Desc` as 'easyDesc')}
                    </T>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.group, { marginTop: space.sm }]}>
              <Row icon="locate" tint="#E9A93B" label={t('aimGuide')} sub={t('aimGuideHint')} last>
                <Toggle label={t('aimGuide')} value={s.guide} onChange={(guide) => updateSettings({ guide })} />
              </Row>
            </View>
          </View>
        </Section>

        <Section title={t('feel')}>
          <View style={styles.pad}>
            <View style={styles.group}>
              <Row icon="volume-high" tint="#FF8A5C" label={t('sound')}>
                <Toggle label={t('sound')} value={s.sound} onChange={(sound) => updateSettings({ sound })} />
              </Row>
              <Row icon="musical-notes" tint="#B26BFF" label={t('music')}>
                <Toggle label={t('music')} value={s.music} onChange={(music) => updateSettings({ music })} />
              </Row>
              <Row icon="pulse" tint="#5B9DFF" label={t('haptics')}>
                <Toggle label={t('haptics')} value={s.haptics} onChange={(haptics) => updateSettings({ haptics })} />
              </Row>
              <Row icon="eye" tint="#2FBF8F" label={t('reducedMotion')} sub={t('reducedMotionHint')} last>
                <Toggle
                  label={t('reducedMotion')}
                  value={s.reducedMotion}
                  onChange={(reducedMotion) => updateSettings({ reducedMotion })}
                />
              </Row>
            </View>
          </View>
        </Section>

        <Section title={t('language')}>
          <View style={styles.pad}>
            <Segmented<'sys' | 'tr' | 'en'>
              value={s.lang ?? 'sys'}
              onChange={(k) => updateSettings({ lang: k === 'sys' ? null : k })}
              options={[
                { key: 'sys', label: t('system') },
                { key: 'tr', label: 'Türkçe' },
                { key: 'en', label: 'English' },
              ]}
            />
          </View>
        </Section>

        <Section title={t('privacy')}>
          <View style={styles.pad}>
            <View style={styles.privacy}>
              <View style={[styles.tile, { backgroundColor: 'rgba(124,243,212,0.14)' }]}>
                <Ionicons name="shield-checkmark" size={18} color={color.mint} />
              </View>
              <T v="body" muted style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
                {t('privacyText')}
              </T>
            </View>
          </View>
        </Section>

        <View style={[styles.pad, { gap: space.sm }]}>
          <Press label={t('restore')} onPress={restore} style={styles.restore}>
            <Ionicons name="refresh" size={18} color={color.textMuted} />
            <T v="heading" style={{ fontSize: 15, color: color.textMuted }}>
              {t('restore')}
            </T>
          </Press>
          <Press label={t('resetStats')} onPress={confirmReset} style={styles.danger}>
            <Ionicons name="refresh-circle-outline" size={20} color={color.danger} />
            <T v="heading" style={{ color: color.danger, fontSize: 15 }}>
              {t('resetStats')}
            </T>
          </Press>
        </View>

        <View style={{ alignItems: 'center', gap: 2 }}>
          <T v="heading" style={{ fontFamily: font.black, letterSpacing: -0.3 }}>
            {Constants.expoConfig?.name}
            <T v="heading" style={{ color: active.accent, fontFamily: font.black }}>
              .
            </T>
          </T>
          <T v="caption" faint>
            {t('version')} {Constants.expoConfig?.version}
          </T>
        </View>
      </ScrollView>
    </View>
  );
}

function ThemeCard({
  theme,
  selected,
  bestFloors,
  pro,
  label,
  lockLabel,
  selectedLabel,
  openLabel,
  onPress,
}: {
  theme: SkyTheme;
  selected: boolean;
  bestFloors: number;
  pro: boolean;
  label: string;
  lockLabel: string;
  selectedLabel: string;
  openLabel: string;
  onPress: () => void;
}) {
  const open = pro || isUnlocked(theme, bestFloors);
  const progress = theme.unlockFloors ? Math.min(1, bestFloors / theme.unlockFloors) : 1;
  return (
    <Press
      label={label}
      disabled={!open}
      onPress={onPress}
      style={[styles.themeCard, selected && { borderColor: theme.accent }]}
    >
      <View style={styles.preview}>
        <ThemePreview theme={theme} width={128} height={150} />
        {!open && (
          <View style={styles.lock}>
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={14} color={color.text} />
            </View>
          </View>
        )}
        {selected && (
          <View style={[styles.check, { backgroundColor: theme.accent }]}>
            <Ionicons name="checkmark" size={14} color={color.accentInk} />
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 10, paddingTop: 8, gap: 6 }}>
        <T v="caption" numberOfLines={1} style={{ fontFamily: selected ? font.bold : font.semibold, fontSize: 13 }}>
          {label}
        </T>
        {open ? (
          <T v="caption" numberOfLines={1} style={{ fontSize: 11, color: selected ? theme.accent : color.textFaint }}>
            {selected ? selectedLabel : openLabel}
          </T>
        ) : (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: theme.accent }]} />
            </View>
            <T v="caption" faint numberOfLines={1} style={{ fontSize: 11 }}>
              {lockLabel}
            </T>
          </>
        )}
      </View>
    </Press>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={[styles.pad, styles.sectionHead]}>
        <T v="label" faint>
          {title}
        </T>
        {hint && (
          <T v="caption" muted>
            {hint}
          </T>
        )}
      </View>
      {children}
    </View>
  );
}

function Row({
  icon,
  tint,
  label,
  sub,
  children,
  last,
}: {
  icon: IconName;
  tint: string;
  label: string;
  sub?: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.tile, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={17} color="#FFFFFF" />
      </View>
      <View style={[styles.rowBody, !last && styles.rowBorder]}>
        <View style={{ flex: 1 }}>
          <T v="body" style={{ fontSize: 15 }}>
            {label}
          </T>
          {sub && (
            <T v="caption" faint>
              {sub}
            </T>
          )}
        </View>
        {children}
      </View>
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
    paddingBottom: space.md,
  },
  pad: { paddingHorizontal: space.lg },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  themeCard: {
    width: 132,
    paddingBottom: 12,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  preview: { width: 128, height: 150, borderRadius: radius.md, overflow: 'hidden' },
  lock: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8,10,20,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
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
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  diffs: { flexDirection: 'row', gap: space.sm },
  diff: {
    flex: 1,
    padding: space.md,
    gap: 4,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.surface,
    minHeight: 128,
  },
  diffIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceStrong,
    marginBottom: 6,
  },
  group: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.surface },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.md, gap: space.md },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingRight: space.md,
    minHeight: 58,
    paddingVertical: 8,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  tile: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  privacy: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,193,94,0.35)',
  },
  gem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.gold,
  },
  restore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  danger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,93,108,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,93,108,0.25)',
  },
});
