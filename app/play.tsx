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
  LIVES_MAX,
  canContinue,
  continueRun,
  createGame,
  drop,
  type GameEvent,
  type GameState,
} from '@/engine';
import { useT } from '@/i18n';
import { GameCanvas } from '@/render/GameCanvas';
import { getTheme } from '@/render/themes';
import { rewardedReady, showRewarded } from '@/services/ads';
import { gameFeedback } from '@/services/feedback';
import { dailySeed, todayKey } from '@/state/daily';
import { markTutorialDone, recordRun, spendTokens, useProgress, useSettings } from '@/state/store';
import { Button, Coin, Glass, IconButton, T } from '@/ui/components';
import { color, font, radius, space } from '@/ui/tokens';

type Popup = { id: number; text: string; tone: 'perfect' | 'good' | 'bad' };
type Hud = { score: number; floors: number; combo: number; lives: number };

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

  const newGame = () =>
    daily ? createGame(dailySeed(daily), 'normal') : createGame(randomSeed(), settings.difficulty);
  const game = useRef<GameState>(null as unknown as GameState);
  if (!game.current) game.current = newGame();

  const [hud, setHud] = useState<Hud>({ score: 0, floors: 0, combo: 0, lives: LIVES_MAX });
  const [popup, setPopup] = useState<Popup | null>(null);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState<{ reason: 'collapse' | 'lives' } | null>(null);
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
      } else if (ev.type === 'miss' || ev.type === 'topple') {
        const head = ev.type === 'topple' ? t('collapsed') : ev.tipped ? t('tipped') : t('miss');
        show(ev.livesLeft > 0 ? `${head} · ${t('livesLeft', { n: ev.livesLeft })}` : head, 'bad', 1400);
      } else if (ev.type === 'over') {
        setTimeout(() => setOver({ reason: ev.reason }), 350);
      }
    }
    setHud({ score: s.score, floors: s.blocks.length, combo: s.combo, lives: s.lives });
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
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (game.current.phase !== 'over') setPaused((p) => !p);
        return true;
      });
      return () => sub.remove();
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
    setOver(null);
    setPopup(null);
    setHud({ score: 0, floors: 0, combo: 0, lives: LIVES_MAX });
  };

  const exit = () => {
    finalize();
    router.back();
  };

  const s = game.current;
  const continueCost = s.continues + 1;
  const canCont = !daily && over && canContinue(s);

  const doContinue = async (via: 'token' | 'ad') => {
    if (!canContinue(game.current)) return;
    if (via === 'token') {
      if (!spendTokens(continueCost)) return;
    } else if (!(await showRewarded())) {
      return;
    }
    continueRun(game.current);
    setOver(null);
    const g = game.current;
    setHud({ score: g.score, floors: g.blocks.length, combo: g.combo, lives: g.lives });
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
            <View style={styles.lives}>
              {Array.from({ length: LIVES_MAX }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.life, i < hud.lives ? { backgroundColor: theme.accent } : styles.lifeLost]}
                />
              ))}
            </View>
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
          <Glass style={styles.sheet}>
            <T v="title" style={{ textAlign: 'center' }}>
              {t('paused')}
            </T>
            <Button
              title={t('resume')}
              icon="play"
              onPress={() => setPaused(false)}
              style={{ backgroundColor: theme.accent }}
            />
            <Button title={t('home')} kind="secondary" icon="home-outline" onPress={exit} />
          </Glass>
        </Animated.View>
      )}

      {over && (
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
                {over.reason === 'collapse' ? t('collapsed') : t('outOfBlocks')}
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

              {canCont && (
                <View style={{ gap: space.sm }}>
                  <Button
                    title={t('continue')}
                    icon="refresh"
                    onPress={() => doContinue('token')}
                    disabled={progress.tokens < continueCost}
                    style={{ backgroundColor: theme.accent }}
                    right={
                      <View style={styles.cost}>
                        <Coin size={14} />
                        <T v="caption" style={{ color: color.accentInk, fontFamily: font.bold }}>
                          {continueCost}
                        </T>
                      </View>
                    }
                  />
                  {rewardedReady() && (
                    <Button
                      title={t('watchAd')}
                      kind="secondary"
                      icon="play-circle-outline"
                      onPress={() => doContinue('ad')}
                    />
                  )}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button title={t('home')} kind="secondary" icon="home-outline" onPress={exit} style={{ flex: 1 }} />
                <Button
                  title={t('playAgain')}
                  kind={canCont ? 'secondary' : 'primary'}
                  icon="reload"
                  onPress={restart}
                  style={[{ flex: 1.4 }, !canCont && { backgroundColor: theme.accent }]}
                />
              </View>
            </Glass>
          </Animated.View>
        </Animated.View>
      )}
    </View>
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
  lives: { flexDirection: 'row', gap: 4, marginTop: 6 },
  life: { width: 14, height: 4, borderRadius: 2 },
  lifeLost: { backgroundColor: 'rgba(255,255,255,0.2)' },
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
