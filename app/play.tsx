import { Ionicons } from '@expo/vector-icons';
import { getRandomBytes } from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COMBO_MAX,
  MAX_CONTINUES,
  canContinue,
  continueCost,
  continueRun,
  createGame,
  drop,
  type GameEvent,
  type GameState,
  type OverReason,
} from '@/engine';
import { useT } from '@/i18n';
import { GameCanvas } from '@/render/GameCanvas';
import { getTheme } from '@/render/themes';
import { onGameFinished, rewardedReady, showRewarded } from '@/services/ads';
import { gameFeedback, tapFeedback } from '@/services/feedback';
import { dailySeed, todayKey } from '@/state/daily';
import {
  markTutorialDone,
  recordRun,
  spendTokens,
  updateSettings,
  useIsPro,
  useProgress,
  useSettings,
} from '@/state/store';
import { ContinueOffer } from '@/ui/ContinueOffer';
import { Button, Glass, IconButton, T } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';

type Popup = { id: number; text: string; tone: 'perfect' | 'good' | 'bad' };
type Hud = { score: number; floors: number; combo: number };
type Over = { reason: OverReason; stage: 'offer' | 'results' };

function randomSeed() {
  const b = getRandomBytes(4);
  return ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
}

export default function Play() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const daily = mode === 'daily' ? todayKey() : undefined;
  const settings = useSettings();
  const progress = useProgress();
  const theme = getTheme(settings.theme);
  const pro = useIsPro();

  const newGame = () =>
    daily ? createGame(dailySeed(daily), 'normal') : createGame(randomSeed(), settings.difficulty);
  const game = useRef<GameState>(null as unknown as GameState);
  if (!game.current) game.current = newGame();

  const [hud, setHud] = useState<Hud>({ score: 0, floors: 0, combo: 0 });
  const [popup, setPopup] = useState<Popup | null>(null);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState<Over | null>(null);
  const [focused, setFocused] = useState(true);
  const freeUsed = useRef(false); // Pro: oyun başına bir ücretsiz hak
  const [showTutorial, setShowTutorial] = useState(!progress.tutorialDone);
  const recorded = useRef(false);
  const popId = useRef(0);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (text: string, tone: Popup['tone'], ms = 900) => {
    popId.current += 1;
    setPopup({ id: popId.current, text, tone });
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPopup(null), ms);
  };

  // GameCanvas her karede en güncel halini ref üzerinden çağırır
  const onEvents = (evs: GameEvent[]) => {
    const s = game.current;
    for (const ev of evs) {
      gameFeedback(ev);
      if (ev.type === 'land') {
        if (ev.grade === 'perfect') show(ev.combo > 1 ? `${t('perfect')} ×${ev.combo}` : t('perfect'), 'perfect');
        else if (ev.grade === 'good') show(`${t('good')} ×${ev.combo}`, 'good', 650);
        if (showTutorial && s.blocks.length >= 2) {
          setShowTutorial(false);
          markTutorialDone();
        }
      } else if (ev.type === 'over') {
        // bedava hak yok: kayıpta önce jetonla devam teklifi, olmazsa sonuç
        const offer = !daily && canContinue(s);
        setTimeout(() => setOver({ reason: ev.reason, stage: offer ? 'offer' : 'results' }), 450);
        if (!offer) onGameFinished();
      }
    }
    setHud({ score: s.score, floors: s.blocks.length, combo: s.combo });
  };

  const finalize = () => {
    if (recorded.current) return;
    const s = game.current;
    if (s.phase !== 'over') return;
    recorded.current = true;
    recordRun({ score: s.score, floors: s.blocks.length, perfects: s.perfects, difficulty: s.difficulty, daily });
  };

  // ekrandan çıkarken (oyun bitmişse) skoru kaydet
  const finalizeRef = useRef(finalize);
  finalizeRef.current = finalize;
  useEffect(() => () => finalizeRef.current(), []);

  // arka plana geçince otomatik duraklat
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && game.current.phase !== 'over') setPaused(true);
    });
    return () => sub.remove();
  }, []);

  // android geri tuşu: çıkmak yerine duraklat
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (game.current.phase !== 'over') setPaused((p) => !p);
        return true;
      });
      return () => {
        setFocused(false);
        sub.remove();
      };
    }, [])
  );

  const onTap = () => {
    if (paused || over) return;
    drop(game.current);
  };

  const restart = () => {
    finalize();
    recorded.current = false;
    game.current = newGame();
    freeUsed.current = false;
    setOver(null);
    setPopup(null);
    setHud({ score: 0, floors: 0, combo: 0 });
  };

  const exit = () => {
    finalize();
    router.back();
  };

  const s = game.current;

  const doContinue = async (via: 'token' | 'ad' | 'free') => {
    const g = game.current;
    if (!canContinue(g)) return;
    if (via === 'token') {
      if (!spendTokens(continueCost(g))) return;
    } else if (via === 'free') {
      if (!pro || freeUsed.current) return;
      freeUsed.current = true;
    } else if (!(await showRewarded())) {
      return;
    }
    continueRun(g);
    setOver(null);
    setHud({ score: g.score, floors: g.blocks.length, combo: g.combo });
  };

  const toResults = () => {
    setOver((o) => (o ? { ...o, stage: 'results' } : o));
    onGameFinished();
  };

  const comboRatio = Math.min(hud.combo, COMBO_MAX) / COMBO_MAX;
  const fmt = (n: number) => n.toLocaleString(t.locale);

  return (
    <View style={styles.root}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPressIn={onTap}
        accessibilityLabel={t('tapToDrop')}
        accessibilityRole="button"
      >
        <GameCanvas
          game={game}
          theme={theme}
          paused={paused}
          reducedMotion={settings.reducedMotion}
          guide={!daily && (settings.guide || showTutorial)}
          onEvents={onEvents}
        />
      </Pressable>

      {/* HUD */}
      <View pointerEvents="box-none" style={[styles.hud, { paddingTop: insets.top + space.sm }]}>
        {/* tek sıra: vinç kirişinin üstünde kalır */}
        <View style={styles.hudRow} pointerEvents="box-none">
          <View style={styles.side} pointerEvents="box-none">
            <IconButton icon="pause" label={t('paused')} onPress={() => setPaused(true)} />
          </View>

          <View
            style={styles.floorsBox}
            pointerEvents="none"
            accessible
            accessibilityLabel={`${hud.floors} ${t('floors')}`}
          >
            <T style={styles.floorsNum}>{hud.floors}</T>
            <View style={styles.comboTrack}>
              <View
                style={[
                  styles.comboFill,
                  { width: `${comboRatio * 100}%`, backgroundColor: comboRatio >= 0.8 ? color.mint : theme.accent },
                ]}
              />
            </View>
          </View>

          <View style={[styles.side, styles.scoreBox]} pointerEvents="none">
            <T v="number" accessibilityLabel={`${t('score')} ${hud.score}`}>
              {fmt(hud.score)}
            </T>
          </View>
        </View>
      </View>

      {popup && (
        <Animated.View
          key={popup.id}
          pointerEvents="none"
          entering={settings.reducedMotion ? FadeIn.duration(120) : ZoomIn.springify().damping(14).stiffness(260)}
          exiting={FadeOutUp.duration(260)}
          style={styles.popup}
        >
          <T
            style={[
              styles.popupText,
              popup.tone === 'perfect' && { color: '#FFFFFF', textShadowColor: color.mint },
              popup.tone === 'good' && { color: '#FFFFFF', textShadowColor: theme.accent },
              popup.tone === 'bad' && { color: color.danger, fontSize: 22 },
            ]}
          >
            {popup.text}
          </T>
        </Animated.View>
      )}

      {showTutorial && !over && !paused && <TutorialHint text={t('tutorial2')} sub={t('tutorial3')} />}

      {paused && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.overlay}>
          <Glass strong style={[styles.sheet, { marginBottom: insets.bottom }]}>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <T v="title">{t('paused')}</T>
              <T v="caption" faint>
                {hud.floors} {t('floors').toLowerCase()} · {fmt(hud.score)}
              </T>
            </View>
            <View style={styles.quick}>
              <QuickToggle
                icon={settings.sound ? 'volume-high' : 'volume-mute'}
                label={t('sound')}
                on={settings.sound}
                accent={theme.accent}
                onPress={() => updateSettings({ sound: !settings.sound })}
              />
              <QuickToggle
                icon="musical-notes"
                label={t('music')}
                on={settings.music}
                accent={theme.accent}
                onPress={() => updateSettings({ music: !settings.music })}
              />
              <QuickToggle
                icon="pulse"
                label={t('haptics')}
                on={settings.haptics}
                accent={theme.accent}
                onPress={() => updateSettings({ haptics: !settings.haptics })}
              />
            </View>
            <Button
              title={t('resume')}
              icon="play"
              onPress={() => setPaused(false)}
              style={{ backgroundColor: theme.accent }}
            />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title={t('home')} kind="secondary" icon="home-outline" onPress={exit} style={{ flex: 1 }} />
              <Button
                title={t('restart')}
                kind="secondary"
                icon="reload"
                onPress={() => {
                  restart();
                  setPaused(false);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </Glass>
        </Animated.View>
      )}

      {over?.stage === 'offer' && (
        <Animated.View
          entering={FadeIn.duration(220)}
          style={[styles.overlay, { paddingBottom: insets.bottom + space.lg }]}
        >
          <ContinueOffer
            reason={over.reason}
            floors={s.blocks.length}
            score={s.score}
            cost={continueCost(s)}
            tokens={progress.tokens}
            livesLeft={MAX_CONTINUES - s.continues}
            free={pro && !freeUsed.current}
            ad={rewardedReady()}
            accent={theme.accent}
            active={focused}
            onBuy={() => doContinue('token')}
            onFree={() => doContinue('free')}
            onAd={() => doContinue('ad')}
            onShop={() => router.push('/shop')}
            onDecline={toResults}
          />
        </Animated.View>
      )}

      {over?.stage === 'results' && (
        <Animated.View
          entering={FadeIn.duration(220)}
          style={[styles.overlay, { paddingBottom: insets.bottom + space.lg }]}
        >
          <Animated.View entering={FadeInDown.springify().damping(18)} style={{ width: '100%' }}>
            <Glass strong style={styles.sheet}>
              <T
                v="label"
                style={{ textAlign: 'center', color: over.reason === 'collapse' ? color.danger : theme.accent }}
              >
                {t(`reason.${over.reason}` as 'reason.miss')}
              </T>
              <View style={{ alignItems: 'center' }}>
                <T style={styles.bigScore}>{fmt(s.score)}</T>
                {s.score > 0 &&
                  s.score >
                    (daily
                      ? progress.daily?.date === daily
                        ? progress.daily.best
                        : 0
                      : progress.best[s.difficulty]) && (
                    <View style={[styles.badge, { backgroundColor: color.gold }]}>
                      <Ionicons name="trophy" size={13} color={color.accentInk} />
                      <T v="label" style={{ color: color.accentInk }}>
                        {t('newBest')}
                      </T>
                    </View>
                  )}
              </View>

              <View style={styles.stats}>
                <Stat label={t('floors')} value={String(s.blocks.length)} />
                <View style={styles.divider} />
                <Stat label={t('perfects')} value={String(s.perfects)} />
                <View style={styles.divider} />
                <Stat label={t('bestCombo')} value={`×${s.bestCombo}`} />
              </View>

              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button title={t('home')} kind="secondary" icon="home-outline" onPress={exit} style={{ flex: 1 }} />
                <Button
                  title={t('playAgain')}
                  icon="reload"
                  onPress={restart}
                  style={{ flex: 1.4, backgroundColor: theme.accent }}
                />
              </View>
            </Glass>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

function QuickToggle({
  icon,
  label,
  on,
  accent,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  on: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={{ alignItems: 'center', gap: 6, flex: 1 }}
    >
      <View style={[styles.quickBtn, on && { backgroundColor: accent + '26', borderColor: accent }]}>
        <Ionicons name={icon} size={22} color={on ? accent : color.textFaint} />
      </View>
      <T v="caption" faint={!on} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <T v="number">{value}</T>
      <T v="caption" faint numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

function TutorialHint({ text, sub }: { text: string; sub: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(withTiming(-8, { duration: 520 }), withTiming(0, { duration: 520 })), -1);
  }, [y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View entering={FadeIn.delay(400)} exiting={FadeOut} pointerEvents="none" style={styles.tutorial}>
      <Animated.View style={a}>
        <Ionicons name="hand-left-outline" size={34} color={color.text} />
      </Animated.View>
      <T v="heading" style={{ textAlign: 'center' }}>
        {text}
      </T>
      <T v="caption" muted style={{ textAlign: 'center' }}>
        {sub}
      </T>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  hud: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: space.lg },
  hudRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  side: { width: 96 },
  scoreBox: { alignItems: 'flex-end', paddingTop: 4 },
  floorsBox: { alignItems: 'center' },
  floorsNum: {
    fontFamily: font.black,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.5,
    color: color.text,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowRadius: 10,
  },
  comboTrack: {
    width: 64,
    height: 3,
    borderRadius: 2,
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  comboFill: { height: '100%', borderRadius: 2 },
  popup: { position: 'absolute', top: '40%', left: 0, right: 0, alignItems: 'center' },
  popupText: {
    fontFamily: font.black,
    fontSize: 30,
    letterSpacing: -0.6,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.scrim,
    justifyContent: 'flex-end',
    padding: space.lg,
  },
  sheet: { padding: space.xl, gap: space.lg },
  bigScore: {
    fontFamily: font.black,
    fontSize: 56,
    lineHeight: 62,
    letterSpacing: -2,
    color: color.text,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  divider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: color.borderStrong },
  quick: { flexDirection: 'row', gap: space.sm },
  quickBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  tutorial: {
    position: 'absolute',
    alignSelf: 'center',
    top: '52%',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    marginHorizontal: space.xl,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(11,15,26,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
  },
});
