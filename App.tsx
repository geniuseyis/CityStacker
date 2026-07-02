import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addToLeaderboard,
  DEFAULT_SETTINGS,
  Difficulty,
  loadBestFloors,
  loadHighScore,
  loadLeaderboard,
  loadPlayerName,
  loadSettings,
  resetRecord,
  saveRecord,
  savePlayerName,
  saveSettings,
  ScoreEntry,
  Settings,
} from './src/storage';
import {
  initSound,
  pauseMusic,
  playSfx,
  setMusicEnabled,
  setSoundEnabled,
  startMusic,
} from './src/sound';
import { getTheme, Theme, THEMES } from './src/themes';

/* ================================================================== *
 *  CITY STACKER  —  kule istifleme oyunu
 * ================================================================== */

const { width: W, height: H } = Dimensions.get('window');
const APP_BG = '#0a1226';

// --- Boyutlar ---
const BLOCK = Math.round(Math.min(64, W * 0.17));
const GROUND_H = 108;
const GROUND_Y = H - GROUND_H;
const PIVOT_Y = 150; // sarkaç pivotu (vinç kolunun altı)
const ROPE_LEN = 132; // halat uzunluğu
const DESIRED_TOP_Y = H * 0.55;

// --- Zorluk / fizik ---
const SPEED_BASE = 1.3; // rad/sn (sarkaç)
const SPEED_STEP = 0.05;
const SPEED_MAX = 4.2;
const AMP_BASE = 0.42; // rad (sarkaç genliği)
const AMP_STEP = 0.012;
const AMP_MAX = 0.8;
const GRAVITY = 3400;
const DROP_V0 = 240;
const PERFECT_TOL = 6;
const GOOD_TOL = 18;
const MAX_DRIFT = BLOCK * 2.4; // taban-tepe kayması bunu aşarsa devrilir

// --- Bina sallanması (kozmetik + zorluk) ---
const SWAY_SPEED = 1.25;

// --- Kombo → halat hızı ---
// Üst üste hizalı koydukça kombo artar, halat hızlanır; bozulunca yavaşça normale döner.
const COMBO_MAX = 10;          // kombo çubuğunun dolduğu değer
const COMBO_SPEED_STEP = 0.11; // her kombo kademesinde hız çarpanı artışı
const COMBO_UP_RATE = 3.5;     // hız çarpanı artış hızı
const COMBO_DOWN_RATE = 0.7;   // bozulunca yavaş geri dönüş

// --- Eğik (yamuk) istif ---
const TILT_PER_OFFSET = 0.34; // derece / px kaçıklık
const TILT_MAX = 17;          // tek blok için maksimum yatış (derece)

// --- Can sistemi (kaçırılan her blok bir can götürür) ---
const LIVES_MAX = 3;
// kombo dahil toplam halat hızı bu değeri aşamaz
const SPEED_HARD_CAP = 6.5;

// Zorluk: normal = orta, zor = baya zor (hız + genlik artar, tolerans + devrilme payı düşer)
const DIFF: Record<Difficulty, { speed: number; amp: number; drift: number; tol: number }> = {
  kolay: { speed: 0.8, amp: 0.85, drift: 1.35, tol: 1.35 },
  normal: { speed: 1.05, amp: 1.0, drift: 1.0, tol: 1.0 },
  zor: { speed: 1.5, amp: 1.28, drift: 0.7, tol: 0.7 },
};

const fmt = (n: number) => n.toLocaleString('tr-TR');
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* --------------------------- Tipler --------------------------- */

type Block = { level: number; x: number; rot: number; colors: [string, string]; lit: boolean[] };
type Active = { x: number; y: number; colors: [string, string]; lit: boolean[] };
type Phase = 'swinging' | 'dropping' | 'falling' | 'gameover';
type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; rot: number; vr: number; g: number;
};

type Game = {
  phase: Phase;
  blocks: Block[];
  cur: Active | null;
  swingT: number;
  swayT: number;
  fallV: number;
  camX: number;          // uygulanan yatay kamera (merkez + sallanma)
  camCenterX: number;    // tepeyi ortalayan kısım (lerp)
  camCenterTarget: number;
  camY: number;
  camYTarget: number;
  score: number;
  combo: number;
  speedMul: number;       // kombo kaynaklı halat hız çarpanı (lerp)
  speedTarget: number;    // hedef hız çarpanı
  flash: number;
  shake: number;
  lives: number;
  particles: Particle[];
  msg: string;
  msgT: number;
};

const levelTop = (level: number) => GROUND_Y - (level + 1) * BLOCK;

function litMask(): boolean[] {
  const m: boolean[] = [];
  for (let i = 0; i < 6; i++) m.push(Math.random() > 0.4);
  return m;
}

function makeActive(level: number, palette: [string, string][]): Active {
  return {
    x: W / 2 - BLOCK / 2,
    y: PIVOT_Y + ROPE_LEN,
    colors: palette[level % palette.length],
    lit: litMask(),
  };
}

function freshGame(diff: Difficulty, palette: [string, string][]): Game {
  return {
    phase: 'swinging',
    blocks: [],
    cur: makeActive(0, palette),
    swingT: 0,
    swayT: Math.random() * Math.PI * 2,
    fallV: 0,
    camX: 0,
    camCenterX: 0,
    camCenterTarget: 0,
    camY: 0,
    camYTarget: 0,
    score: 0,
    combo: 0,
    speedMul: 1,
    speedTarget: 1,
    flash: 0,
    shake: 0,
    lives: LIVES_MAX,
    particles: [],
    msg: '',
    msgT: 0,
  };
}

function swayAmpFor(blocks: number) {
  return Math.min(20, Math.max(0, blocks - 3) * 1.1);
}

function spawnConfetti(s: Game, x: number, y: number, palette: [string, string][]) {
  const colors = palette.flat();
  for (let i = 0; i < 22; i++) {
    const life = 0.9 + Math.random() * 0.5;
    s.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 460,
      vy: -Math.random() * 440 - 120,
      life, max: life,
      size: 5 + Math.random() * 6,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 720,
      g: 1000,
    });
  }
}

function spawnDust(s: Game, x: number, y: number) {
  const colors = ['#9a8a78', '#7b6d5d', '#b0a090', '#6a5d4f'];
  for (let i = 0; i < 26; i++) {
    const life = 1.0 + Math.random() * 0.7;
    s.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 320,
      vy: -Math.random() * 200 - 30,
      life, max: life,
      size: 8 + Math.random() * 12,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 300,
      g: 520,
    });
  }
}

/* =============================== APP =============================== */

type Screen = 'menu' | 'playing' | 'leaderboard';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [playerName, setPlayerName] = useState('Oyuncu');
  const [highScore, setHighScore] = useState(0);
  const [bestFloors, setBestFloors] = useState(0);
  const [board, setBoard] = useState<ScoreEntry[]>([]);
  const highRef = useRef(0);
  const floorsRef = useRef(0);
  const nameRef = useRef('Oyuncu');

  const theme = useMemo(() => getTheme(settings.theme), [settings.theme]);

  useEffect(() => {
    initSound();
    (async () => {
      const loaded = await loadSettings();
      setSettings(loaded);
      setSoundEnabled(loaded.sound);
      setMusicEnabled(loaded.music);
      if (loaded.music) startMusic();
      const [hs, bf, nm, lb] = await Promise.all([
        loadHighScore(),
        loadBestFloors(),
        loadPlayerName(),
        loadLeaderboard(),
      ]);
      highRef.current = hs;
      floorsRef.current = bf;
      nameRef.current = nm;
      setHighScore(hs);
      setBestFloors(bf);
      setPlayerName(nm);
      setBoard(lb);
    })();
  }, []);

  // uygulama arka plana geçince müziği durdur, dönünce devam ettir
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') startMusic();
      else pauseMusic();
    });
    return () => sub.remove();
  }, []);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    setSoundEnabled(next.sound);
    setMusicEnabled(next.music);
    saveSettings(next);
  }, []);

  const updateName = useCallback((name: string) => {
    nameRef.current = name || 'Oyuncu';
    setPlayerName(name);
    savePlayerName(name);
  }, []);

  const onGameOver = useCallback((score: number, floors: number) => {
    const newHigh = Math.max(highRef.current, score);
    const newFloors = Math.max(floorsRef.current, floors);
    highRef.current = newHigh;
    floorsRef.current = newFloors;
    setHighScore(newHigh);
    setBestFloors(newFloors);
    saveRecord(newHigh, newFloors);
    if (score > 0) {
      addToLeaderboard({ name: nameRef.current, score, floors, ts: Date.now() }).then(setBoard);
    }
  }, []);

  const onReset = useCallback(async () => {
    await resetRecord();
    highRef.current = 0;
    floorsRef.current = 0;
    setHighScore(0);
    setBestFloors(0);
    setBoard([]);
  }, []);

  return (
    <View style={styles.app}>
      {screen === 'menu' && (
        <Menu
          theme={theme}
          playerName={playerName}
          highScore={highScore}
          bestFloors={bestFloors}
          onPlay={() => setScreen('playing')}
          onLeaderboard={() => setScreen('leaderboard')}
          onSettings={() => setSettingsOpen(true)}
        />
      )}

      {screen === 'playing' && (
        <GameScreen
          theme={theme}
          settings={settings}
          highScore={highScore}
          paused={settingsOpen}
          onExit={() => setScreen('menu')}
          onSettings={() => setSettingsOpen(true)}
          onGameOver={onGameOver}
        />
      )}

      {screen === 'leaderboard' && (
        <Leaderboard theme={theme} board={board} playerName={playerName} onBack={() => setScreen('menu')} />
      )}

      <SettingsModal
        visible={settingsOpen}
        settings={settings}
        playerName={playerName}
        highScore={highScore}
        bestFloors={bestFloors}
        onChange={updateSettings}
        onChangeName={updateName}
        onReset={onReset}
        onClose={() => setSettingsOpen(false)}
      />

      <StatusBar style="light" />
    </View>
  );
}

/* ============================== MENÜ ============================== */

function Menu({
  theme,
  playerName,
  highScore,
  bestFloors,
  onPlay,
  onLeaderboard,
  onSettings,
}: {
  theme: Theme;
  playerName: string;
  highScore: number;
  bestFloors: number;
  onPlay: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
}) {
  const click = (fn: () => void) => () => {
    playSfx('click');
    fn();
  };
  return (
    <View style={styles.menu}>
      <Sky colors={theme.sky} />
      <BackgroundCity theme={theme} />
      <View style={styles.menuOverlay} />
      <View style={styles.menuContent}>
        <View style={styles.playerChip}>
          <Text style={styles.playerChipTxt}>👤 {playerName}</Text>
        </View>

        <Text style={styles.menuKicker}>R E T R O   T O W E R</Text>
        <Text style={styles.menuTitle}>CITY</Text>
        <Text style={styles.menuTitle2}>STACKER</Text>

        <View style={styles.recordRow}>
          <View style={styles.recordCard}>
            <Text style={styles.recordLabel}>EN YÜKSEK</Text>
            <Text style={styles.recordValue}>{fmt(highScore)}</Text>
          </View>
          <View style={styles.recordCard}>
            <Text style={styles.recordLabel}>EN ÇOK KAT</Text>
            <Text style={styles.recordValue}>{bestFloors}</Text>
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]} onPress={click(onPlay)}>
          <Text style={styles.playBtnTxt}>▶  OYNA</Text>
        </Pressable>

        <View style={styles.menuBtnRow}>
          <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={click(onLeaderboard)}>
            <Text style={styles.secondaryBtnTxt}>🏆  Sıralama</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={click(onSettings)}>
            <Text style={styles.secondaryBtnTxt}>⚙  Ayarlar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* =========================== LİDER TABLOSU =========================== */

function Leaderboard({
  theme,
  board,
  playerName,
  onBack,
}: {
  theme: Theme;
  board: ScoreEntry[];
  playerName: string;
  onBack: () => void;
}) {
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);
  return (
    <View style={styles.menu}>
      <Sky colors={theme.sky} />
      <BackgroundCity theme={theme} />
      <View style={styles.menuOverlay} />
      <View style={styles.lbHeader}>
        <Pressable style={styles.iconBtn} onPress={() => { playSfx('click'); onBack(); }}>
          <Text style={styles.iconTxt}>‹</Text>
        </Pressable>
        <Text style={styles.lbTitle}>🏆 Lider Tablosu</Text>
        <View style={{ width: 44 }} />
      </View>

      {board.length === 0 ? (
        <View style={styles.lbEmpty}>
          <Text style={styles.lbEmptyTxt}>Henüz skor yok.</Text>
          <Text style={styles.lbEmptySub}>İlk rekoru sen kır! 🚀</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.lbList} showsVerticalScrollIndicator={false}>
          {board.map((e, i) => {
            const mine = e.name === playerName;
            return (
              <View key={`${e.ts}-${i}`} style={[styles.lbRow, mine && styles.lbRowMine]}>
                <Text style={styles.lbRank}>{medal(i)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lbName} numberOfLines={1}>
                    {e.name} {mine ? '(sen)' : ''}
                  </Text>
                  <Text style={styles.lbFloors}>{e.floors} kat</Text>
                </View>
                <Text style={styles.lbScore}>{fmt(e.score)}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/* ============================= OYUN ============================= */

function GameScreen({
  theme,
  settings,
  highScore,
  paused,
  onExit,
  onSettings,
  onGameOver,
}: {
  theme: Theme;
  settings: Settings;
  highScore: number;
  paused: boolean;
  onExit: () => void;
  onSettings: () => void;
  onGameOver: (score: number, floors: number) => void;
}) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const g = useRef<Game>(freshGame(settings.difficulty, theme.blocks));
  const [, force] = useState(0);
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const reported = useRef(false);

  const rerender = useCallback(() => force((v) => (v + 1) % 1e9), []);

  const haptic = useCallback((kind: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
    if (!settingsRef.current.vibration) return;
    const swallow = (p: Promise<unknown>) => p.catch(() => {});
    try {
      switch (kind) {
        case 'light': swallow(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); break;
        case 'medium': swallow(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)); break;
        case 'heavy': swallow(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)); break;
        case 'success': swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); break;
        case 'error': swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)); break;
      }
    } catch {
      /* yok say */
    }
  }, []);

  // temel halat hızı (zorluk + yükseklik) — kombo çarpanı ayrıca uygulanır
  const speedFor = (blocks: number) =>
    Math.min(SPEED_MAX, (SPEED_BASE + blocks * SPEED_STEP) * DIFF[settingsRef.current.difficulty].speed);
  const ampFor = (blocks: number) =>
    Math.min(AMP_MAX, (AMP_BASE + blocks * AMP_STEP) * DIFF[settingsRef.current.difficulty].amp);

  const land = useCallback(
    (s: Game) => {
      const cur = s.cur!;
      const curCenterWorld = cur.x + BLOCK / 2 - s.camX;
      const landScreenX = cur.x + BLOCK / 2;
      const landScreenY = cur.y;
      const n = s.blocks.length;
      const diff = DIFF[settingsRef.current.difficulty];
      const perfectTol = PERFECT_TOL * diff.tol;
      const goodTol = GOOD_TOL * diff.tol;

      let offset: number;
      if (n === 0) {
        offset = curCenterWorld - W / 2;
      } else {
        const below = s.blocks[n - 1];
        offset = curCenterWorld - (below.x + BLOCK / 2);
        if (Math.abs(offset) >= BLOCK) {
          s.phase = 'falling';
          s.fallV = 0;
          s.combo = 0;
          s.speedTarget = 1; // kombo bozuldu → halat yavaşça normale döner
          s.lives -= 1;
          s.msg = s.lives > 0 ? `ISKA! ${s.lives} HAK KALDI` : 'ISKA!';
          s.msgT = 1.4;
          haptic('error');
          playSfx('crash');
          spawnDust(s, landScreenX, landScreenY);
          return;
        }
      }

      // yamuk istif: blok kaçıklığı kadar yana yatar (videodaki gibi eğik kule)
      const rot = clamp(offset * TILT_PER_OFFSET, -TILT_MAX, TILT_MAX);
      s.blocks.push({ level: n, x: cur.x - s.camX, rot, colors: cur.colors, lit: cur.lit });
      s.cur = null;

      const a = Math.abs(offset);
      if (a <= perfectTol) {
        s.combo += 1;
        s.score += 100 + s.combo * 25;
        s.flash = 1;
        s.msg = s.combo > 1 ? `MÜKEMMEL ×${s.combo}` : 'MÜKEMMEL!';
        s.msgT = 0.9;
        haptic('success');
        playSfx('perfect');
        spawnConfetti(s, landScreenX, landScreenY, themeRef.current.blocks);
      } else if (a <= goodTol) {
        s.combo += 1; // hizalı sayılır → kombo sürer
        s.score += 40 + s.combo * 8;
        s.msg = `İYİ ×${s.combo}`;
        s.msgT = 0.6;
        haptic('light');
        playSfx('place');
      } else {
        s.combo = 0; // bozuldu
        s.score += 15;
        s.msg = '';
        s.msgT = 0;
        haptic('light');
        playSfx('place');
      }

      // kombo → halat hız hedefi
      s.speedTarget = 1 + Math.min(s.combo, COMBO_MAX) * COMBO_SPEED_STEP;

      // devrilme: taban ile tepe arasındaki yatay kayma (zorlukla daralır)
      const drift = s.blocks[s.blocks.length - 1].x - s.blocks[0].x;
      if (Math.abs(drift) > MAX_DRIFT * diff.drift) {
        s.phase = 'gameover';
        s.shake = 1;
        s.msg = 'KULE YIKILDI!';
        s.msgT = 99;
        haptic('heavy');
        playSfx('crash');
        const lastB = s.blocks[s.blocks.length - 1];
        spawnDust(s, lastB.x + s.camX + BLOCK / 2, levelTop(lastB.level) + s.camY);
        return;
      }

      // kamerayı yeni tepeye göre ortala, dikeyde yukarı kaydır
      const topCenter = s.blocks[s.blocks.length - 1].x + BLOCK / 2;
      s.camCenterTarget = W / 2 - topCenter;
      const natural = GROUND_Y - s.blocks.length * BLOCK;
      s.camYTarget = Math.max(0, DESIRED_TOP_Y - natural);

      s.cur = makeActive(s.blocks.length, themeRef.current.blocks);
      s.swingT = 0;
      s.phase = 'swinging';
    },
    [haptic]
  );

  const dropNow = (s: Game) => {
    s.phase = 'dropping';
    s.fallV = DROP_V0;
    haptic('light');
    playSfx('drop');
  };

  const tick = useCallback(
    (now: number) => {
      const s = g.current;
      // ayarlar açıkken oyun donar; dt sıçramasın diye saat ilerletilir
      if (pausedRef.current) {
        last.current = now;
        raf.current = requestAnimationFrame(tick);
        return;
      }
      if (!last.current) last.current = now;
      let dt = (now - last.current) / 1000;
      last.current = now;
      if (dt > 0.033) dt = 0.033;

      if (s.msgT > 0 && s.msgT < 90) s.msgT = Math.max(0, s.msgT - dt);
      if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 2.5);
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 2);

      // parçacıklar
      if (s.particles.length) {
        for (const p of s.particles) {
          p.vy += p.g * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          p.life -= dt;
        }
        if (s.particles.some((p) => p.life <= 0)) {
          s.particles = s.particles.filter((p) => p.life > 0);
        }
      }

      // kamera + bina sallanması yalnızca salınım fazında ilerler → bırakınca sahne donar
      if (s.phase === 'swinging') {
        s.swayT += SWAY_SPEED * dt;
        s.camCenterX += (s.camCenterTarget - s.camCenterX) * Math.min(1, dt * 6);
        s.camY += (s.camYTarget - s.camY) * Math.min(1, dt * 6);
      }
      s.camX = s.camCenterX + swayAmpFor(s.blocks.length) * Math.sin(s.swayT);

      if (s.phase === 'swinging' && s.cur) {
        // kombo → halat hız çarpanı: hedefe doğru yumuşak geçiş
        const rate = s.speedTarget > s.speedMul ? COMBO_UP_RATE : COMBO_DOWN_RATE;
        s.speedMul += (s.speedTarget - s.speedMul) * Math.min(1, dt * rate);
        const speed = Math.min(SPEED_HARD_CAP, speedFor(s.blocks.length) * s.speedMul);
        const amp = ampFor(s.blocks.length);
        s.swingT += speed * dt;
        const angle = amp * Math.sin(s.swingT);
        const bx = W / 2 + ROPE_LEN * Math.sin(angle);
        const by = PIVOT_Y + ROPE_LEN * Math.cos(angle);
        s.cur.x = bx - BLOCK / 2;
        s.cur.y = by;
      } else if (s.phase === 'dropping' && s.cur) {
        s.fallV += GRAVITY * dt;
        s.cur.y += s.fallV * dt;
        const target = GROUND_Y - s.blocks.length * BLOCK + s.camY - BLOCK;
        if (s.cur.y >= target) {
          s.cur.y = target;
          land(s);
        }
      } else if (s.phase === 'falling' && s.cur) {
        s.fallV += GRAVITY * dt;
        s.cur.y += s.fallV * dt;
        s.cur.x += 36 * dt;
        if (s.cur.y > H + 120) {
          if (s.lives > 0) {
            // can kaldı → yeni blok gelsin, oyun sürsün
            s.cur = makeActive(s.blocks.length, themeRef.current.blocks);
            s.swingT = 0;
            s.fallV = 0;
            s.phase = 'swinging';
          } else {
            s.cur = null;
            s.phase = 'gameover';
            s.msgT = 99;
            s.msg = 'BLOKLAR BİTTİ!';
          }
        }
      }

      if (s.phase === 'gameover' && !reported.current) {
        reported.current = true;
        onGameOver(s.score, s.blocks.length);
      }

      rerender();
      raf.current = requestAnimationFrame(tick);
    },
    [land, onGameOver, rerender]
  );

  useEffect(() => {
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [tick]);

  const onTap = () => {
    const s = g.current;
    if (s.phase === 'swinging' && s.cur) {
      dropNow(s);
    } else if (s.phase === 'gameover') {
      reported.current = false;
      g.current = freshGame(settingsRef.current.difficulty, themeRef.current.blocks);
    }
  };

  const restart = () => {
    reported.current = false;
    g.current = freshGame(settingsRef.current.difficulty, themeRef.current.blocks);
    rerender();
  };

  const s = g.current;
  const floors = s.blocks.length;
  const shakeX = s.shake > 0 ? (Math.random() - 0.5) * s.shake * 14 : 0;
  const comboRatio = Math.min(s.combo, COMBO_MAX) / COMBO_MAX;
  const comboColor = comboRatio >= 0.8 ? '#ff5ad2' : comboRatio >= 0.4 ? '#ff9f3d' : '#ffd54a';

  return (
    <Pressable style={styles.game} onPress={onTap}>
      <View style={{ flex: 1, transform: [{ translateX: shakeX }] }}>
        <Sky colors={theme.sky} />
        <BackgroundCity theme={theme} />

        {(s.phase === 'swinging' || s.phase === 'dropping') && s.cur && (
          <Crane rope={s.phase === 'swinging' ? { x: s.cur.x + BLOCK / 2, y: s.cur.y } : null} />
        )}

        {/* Kule — yatay+dikey kamera takibi */}
        <View
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, transform: [{ translateX: s.camX }, { translateY: s.camY }] }}
          pointerEvents="none"
        >
          {s.blocks.map((b) => (
            <BlockView
              key={b.level}
              x={b.x}
              y={levelTop(b.level)}
              rot={b.rot}
              colors={b.colors}
              lit={b.lit}
              winLit={theme.windowLit}
              winDark={theme.windowDark}
              isBase={b.level === 0}
            />
          ))}
        </View>

        {/* Aktif (salınan/düşen) blok — ekran uzayında */}
        {s.cur && (
          <BlockView
            x={s.cur.x}
            y={s.cur.y}
            rot={0}
            colors={s.cur.colors}
            lit={s.cur.lit}
            winLit={theme.windowLit}
            winDark={theme.windowDark}
            isBase={false}
          />
        )}

        {/* Parçacıklar */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {s.particles.map((p, i) => (
            <View
              key={i}
              style={{
                position: 'absolute', left: p.x, top: p.y, width: p.size, height: p.size,
                backgroundColor: p.color, borderRadius: 1,
                opacity: clamp(p.life / p.max, 0, 1),
                transform: [{ rotate: `${p.rot}deg` }],
              }}
            />
          ))}
        </View>

        <View style={[styles.ground, { backgroundColor: theme.ground, borderTopColor: theme.groundBorder }]}>
          <View style={[styles.street, { backgroundColor: theme.street }]} />
        </View>
      </View>

      {s.flash > 0 && <View pointerEvents="none" style={[styles.flash, { opacity: s.flash * 0.45 }]} />}

      {/* Kombo çubuğu */}
      <View style={styles.comboWrap} pointerEvents="none">
        <Text style={styles.comboStar}>⚡</Text>
        <View style={styles.comboTrack}>
          <View style={[styles.comboFill, { width: `${comboRatio * 100}%`, backgroundColor: comboColor }]} />
        </View>
        <Text style={styles.comboMul}>×{Math.max(1, s.combo)}</Text>
      </View>

      {/* Üst butonlar + canlar */}
      <View style={styles.topRow} pointerEvents="box-none">
        <Pressable style={styles.iconBtn} onPress={() => { playSfx('click'); onExit(); }}>
          <Text style={styles.iconTxt}>‹</Text>
        </Pressable>
        <View style={styles.livesRow} pointerEvents="none">
          {Array.from({ length: LIVES_MAX }).map((_, i) => (
            <Text key={i} style={[styles.lifeHeart, i >= s.lives && styles.lifeLost]}>
              ❤️
            </Text>
          ))}
        </View>
        <Pressable style={styles.iconBtn} onPress={() => { playSfx('click'); onSettings(); }}>
          <Text style={styles.iconTxt}>⚙</Text>
        </Pressable>
      </View>

      {/* HUD */}
      <View style={styles.hudLeft}>
        <Text style={styles.hudIcon}>🏢</Text>
        <Text style={styles.hudNum}>{String(floors).padStart(3, '0')}</Text>
      </View>
      <View style={styles.hudRight}>
        <Text style={styles.hudNum}>{String(s.score).padStart(6, '0')}</Text>
        <Text style={styles.hudIcon}>⭐</Text>
      </View>

      {!!s.msg && s.phase !== 'gameover' && s.msgT > 0 && (
        <View style={styles.msgWrap} pointerEvents="none">
          <Text style={styles.msgTxt}>{s.msg}</Text>
        </View>
      )}

      {s.phase === 'gameover' && (
        <View style={styles.overlay}>
          <Text style={styles.goTitle}>{s.msg || 'OYUN BİTTİ'}</Text>
          <View style={styles.goStats}>
            <View style={styles.goStatCol}>
              <Text style={styles.goStatVal}>{fmt(s.score)}</Text>
              <Text style={styles.goStatLbl}>PUAN</Text>
            </View>
            <View style={styles.goDivider} />
            <View style={styles.goStatCol}>
              <Text style={styles.goStatVal}>{floors}</Text>
              <Text style={styles.goStatLbl}>KAT</Text>
            </View>
          </View>
          {s.score >= highScore && s.score > 0 && <Text style={styles.newBest}>🏆 YENİ REKOR!</Text>}
          <Pressable style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]} onPress={restart}>
            <Text style={styles.playBtnTxt}>↺  TEKRAR OYNA</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed, { marginTop: 12 }]}
            onPress={() => { playSfx('click'); onExit(); }}
          >
            <Text style={styles.secondaryBtnTxt}>Ana Menü</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

/* =========================== AYARLAR =========================== */

function SettingsModal({
  visible,
  settings,
  playerName,
  highScore,
  bestFloors,
  onChange,
  onChangeName,
  onReset,
  onClose,
}: {
  visible: boolean;
  settings: Settings;
  playerName: string;
  highScore: number;
  bestFloors: number;
  onChange: (s: Settings) => void;
  onChangeName: (n: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const diffs: { key: Difficulty; label: string }[] = [
    { key: 'kolay', label: 'Kolay' },
    { key: 'normal', label: 'Normal' },
    { key: 'zor', label: 'Zor' },
  ];

  const change = (next: Settings) => {
    setDirty(true);
    onChange(next);
  };
  const close = () => {
    playSfx('click');
    setDirty(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Ayarlar</Text>

            <Text style={styles.fieldLabel}>Oyuncu Adı</Text>
            <TextInput
              style={styles.nameInput}
              value={playerName}
              onChangeText={(t) => { setDirty(true); onChangeName(t); }}
              placeholder="Adın"
              placeholderTextColor="#6b7da0"
              maxLength={16}
              returnKeyType="done"
            />

            <Text style={styles.fieldLabel}>Tema</Text>
            <View style={styles.themeRow}>
              {THEMES.map((t) => {
                const sel = settings.theme === t.key;
                return (
                  <Pressable
                    key={t.key}
                    style={[styles.themeChip, { borderColor: sel ? '#ffd54a' : 'rgba(255,255,255,0.12)' }]}
                    onPress={() => { playSfx('click'); change({ ...settings, theme: t.key }); }}
                  >
                    <View style={styles.themePreview}>
                      <View style={{ flex: 1, backgroundColor: t.sky[0] }} />
                      <View style={{ flex: 1, backgroundColor: t.sky[1] }} />
                      <View style={[styles.themeDot, { backgroundColor: t.blocks[0][0] }]} />
                    </View>
                    <Text style={[styles.themeLabel, sel && { color: '#ffd54a' }]}>{t.emoji} {t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>🔊  Ses Efektleri</Text>
              <Toggle on={settings.sound} onPress={() => { const next = { ...settings, sound: !settings.sound }; change(next); if (next.sound) playSfx('click'); }} />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>🎵  Müzik</Text>
              <Toggle on={settings.music} onPress={() => { playSfx('click'); change({ ...settings, music: !settings.music }); }} />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>📳  Titreşim / Haptik</Text>
              <Toggle on={settings.vibration} onPress={() => { playSfx('click'); change({ ...settings, vibration: !settings.vibration }); }} />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Zorluk</Text>
            <View style={styles.segment}>
              {diffs.map((d) => (
                <Pressable
                  key={d.key}
                  style={[styles.segItem, settings.difficulty === d.key && styles.segItemOn]}
                  onPress={() => { playSfx('click'); change({ ...settings, difficulty: d.key }); }}
                >
                  <Text style={[styles.segTxt, settings.difficulty === d.key && styles.segTxtOn]}>{d.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.statsBox}>
              <View style={styles.statsItem}>
                <Text style={styles.statsVal}>{fmt(highScore)}</Text>
                <Text style={styles.statsLbl}>En Yüksek Puan</Text>
              </View>
              <View style={styles.goDivider} />
              <View style={styles.statsItem}>
                <Text style={styles.statsVal}>{bestFloors}</Text>
                <Text style={styles.statsLbl}>En Çok Kat</Text>
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]} onPress={() => { playSfx('click'); setDirty(true); onReset(); }}>
                <Text style={styles.resetTxt}>Sıfırla</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]} onPress={close}>
                <Text style={styles.closeTxt}>{dirty ? 'Kaydet ve Kapat' : 'Kapat'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.toggle, on && styles.toggleOn]} onPress={onPress}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </Pressable>
  );
}

/* ========================== BİLEŞENLER ========================== */

const BlockView = memo(function BlockView({
  x,
  y,
  rot,
  colors,
  lit,
  winLit,
  winDark,
  isBase,
}: {
  x: number;
  y: number;
  rot: number;
  colors: [string, string];
  lit: boolean[];
  winLit: string;
  winDark: string;
  isBase: boolean;
}) {
  return (
    <View
      style={{
        position: 'absolute', left: x, top: y, width: BLOCK, height: BLOCK,
        backgroundColor: colors[0],
        borderBottomWidth: 4, borderRightWidth: 3, borderLeftWidth: 1,
        borderColor: colors[1], borderRadius: 2,
        transform: [{ rotate: `${rot}deg` }],
      }}
    >
      {/* çatı silmesi (kat ayrımı) */}
      <View style={{ height: BLOCK * 0.16, backgroundColor: colors[1], opacity: 0.55 }} />
      {/* pencere ızgarası 3x2 */}
      <View style={styles.winGrid}>
        {lit.map((l, i) => (
          <View key={i} style={[styles.winFrame, { backgroundColor: colors[1] }]}>
            <View style={{ flex: 1, backgroundColor: l ? winLit : winDark }} />
          </View>
        ))}
      </View>
      {/* zemin katta kapı */}
      {isBase && (
        <View style={{ position: 'absolute', bottom: 0, left: BLOCK / 2 - BLOCK * 0.11, width: BLOCK * 0.22, height: BLOCK * 0.3, backgroundColor: colors[1], borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
      )}
    </View>
  );
});

function Crane({ rope }: { rope: { x: number; y: number } | null }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* destek kablosu */}
      <Line x1={W} y1={40} x2={W / 2} y2={PIVOT_Y} color="#11233f" thickness={2} />
      {/* vinç kolu */}
      <View style={styles.craneJib} />
      <View style={styles.craneJibTop} />
      {/* pivot makarası */}
      <View style={styles.cranePulley} />
      {/* halat + kanca (yalnızca salınırken) */}
      {rope && (
        <>
          <Line x1={W / 2} y1={PIVOT_Y} x2={rope.x} y2={rope.y} color="#0c1a30" thickness={3} />
          <View style={{ position: 'absolute', left: rope.x - 7, top: rope.y - 9, width: 14, height: 11, borderWidth: 3, borderTopWidth: 0, borderColor: '#0c1a30', borderBottomLeftRadius: 7, borderBottomRightRadius: 7 }} />
        </>
      )}
    </View>
  );
}

function Line({ x1, y1, x2, y2, color, thickness = 2 }: { x1: number; y1: number; x2: number; y2: number; color: string; thickness?: number }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  return (
    <View style={{ position: 'absolute', left: x1, top: y1 - thickness / 2, width: len, height: thickness, backgroundColor: color, transformOrigin: 'left center', transform: [{ rotateZ: `${angle}rad` }] }} />
  );
}

function Sky({ colors }: { colors: [string, string] }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 10 }).map((_, i) => (
        <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: (H * i) / 10, height: H / 10 + 1, backgroundColor: lerpColor(colors[0], colors[1], i / 9) }} />
      ))}
    </View>
  );
}

function lerpColor(a: string, b: string, t: number) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const BackgroundCity = memo(function BackgroundCity({ theme }: { theme: Theme }) {
  const layers = useMemo(() => {
    const rand = mulberry32(1337);
    const build = (count: number, baseW: number, maxH: number, color: string, opacity: number) => {
      const arr: { x: number; w: number; h: number; color: string; opacity: number; cols: number }[] = [];
      let x = -10;
      for (let i = 0; i < count; i++) {
        const w = baseW * (0.7 + rand() * 0.7);
        const h = maxH * (0.45 + rand() * 0.55);
        arr.push({ x, w, h, color, opacity, cols: Math.max(2, Math.floor(w / 14)) });
        x += w * (0.82 + rand() * 0.2);
      }
      return arr;
    };
    return [
      build(10, W * 0.16, H * 0.42, theme.bgFar, theme.bgFarOpacity),
      build(8, W * 0.2, H * 0.58, theme.bgNear, theme.bgNearOpacity),
    ];
  }, [theme]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {layers.map((layer, li) =>
        layer.map((b, i) => (
          <View key={`${li}-${i}`} style={{ position: 'absolute', left: b.x, bottom: GROUND_H - 16, width: b.w, height: b.h, backgroundColor: b.color, opacity: b.opacity }}>
            <View style={styles.bgWindows}>
              {Array.from({ length: b.cols * 3 }).map((_, k) => (
                <View key={k} style={[styles.bgWindow, { backgroundColor: theme.bgWindow }]} />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
});

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================ STİLLER ============================ */

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: APP_BG },

  menu: { flex: 1, backgroundColor: APP_BG },
  menuOverlay: { ...absFill(), backgroundColor: 'rgba(8,20,45,0.28)' },
  menuContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  playerChip: { position: 'absolute', top: 56, backgroundColor: 'rgba(8,20,45,0.5)', borderColor: 'rgba(255,255,255,0.18)', borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  playerChipTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  menuKicker: { color: '#cfe4ff', letterSpacing: 4, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  menuTitle: { color: '#fff', fontSize: 68, fontWeight: '900', letterSpacing: 2, lineHeight: 66 },
  menuTitle2: { color: '#ffd54a', fontSize: 68, fontWeight: '900', letterSpacing: 2, lineHeight: 70, marginBottom: 34, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 5 }, textShadowRadius: 8 },
  recordRow: { flexDirection: 'row', gap: 14, marginBottom: 36 },
  recordCard: { backgroundColor: 'rgba(8,20,45,0.45)', borderColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', minWidth: 130 },
  recordLabel: { color: '#a9c6ec', fontSize: 11, letterSpacing: 1.5, fontWeight: '800', marginBottom: 4 },
  recordValue: { color: '#fff', fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },

  playBtn: { backgroundColor: '#ff8a3d', paddingVertical: 18, paddingHorizontal: 60, borderRadius: 18, shadowColor: '#ff8a3d', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  playBtnTxt: { color: '#231405', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  menuBtnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  secondaryBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1, paddingVertical: 14, paddingHorizontal: 26, borderRadius: 16 },
  secondaryBtnTxt: { color: '#eaf3ff', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },

  lbHeader: { position: 'absolute', top: 52, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lbTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  lbEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lbEmptyTxt: { color: '#fff', fontSize: 20, fontWeight: '800' },
  lbEmptySub: { color: '#bcd4f5', fontSize: 15, marginTop: 8 },
  lbList: { paddingTop: 110, paddingHorizontal: 18, paddingBottom: 30 },
  lbRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(8,20,45,0.5)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  lbRowMine: { borderColor: '#ffd54a', backgroundColor: 'rgba(255,213,74,0.14)' },
  lbRank: { color: '#fff', fontSize: 20, fontWeight: '900', width: 40 },
  lbName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  lbFloors: { color: '#a9c6ec', fontSize: 12, marginTop: 2 },
  lbScore: { color: '#ffd54a', fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },

  game: { flex: 1, backgroundColor: APP_BG, overflow: 'hidden' },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: GROUND_H, borderTopWidth: 4 },
  street: { position: 'absolute', left: 0, right: 0, top: 26, height: 3, opacity: 0.4 },
  flash: { ...absFill(), backgroundColor: '#fff' },

  craneJib: { position: 'absolute', left: 0, right: 0, top: PIVOT_Y - 6, height: 10, backgroundColor: '#11233f' },
  craneJibTop: { position: 'absolute', left: 0, right: 0, top: PIVOT_Y - 10, height: 4, backgroundColor: '#ffd54a', opacity: 0.6 },
  cranePulley: { position: 'absolute', left: W / 2 - 7, top: PIVOT_Y - 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#ffb347', borderWidth: 2, borderColor: '#11233f' },

  comboWrap: { position: 'absolute', top: 104, left: 18, right: 18, flexDirection: 'row', alignItems: 'center' },
  comboStar: { color: '#ffd54a', fontSize: 20, marginRight: 8, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 2 },
  comboTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.3)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  comboFill: { height: '100%', borderRadius: 6 },
  comboMul: { color: '#fff', fontSize: 16, fontWeight: '900', marginLeft: 8, minWidth: 30 },
  livesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(8,20,45,0.55)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  lifeHeart: { fontSize: 18 },
  lifeLost: { opacity: 0.22 },

  topRow: { position: 'absolute', top: 50, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(8,20,45,0.55)', alignItems: 'center', justifyContent: 'center' },
  iconTxt: { color: '#fff', fontSize: 22, fontWeight: '900', lineHeight: 24 },

  hudLeft: { position: 'absolute', left: 16, bottom: 30, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(8,20,45,0.72)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22 },
  hudRight: { position: 'absolute', right: 16, bottom: 30, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(8,20,45,0.72)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22 },
  hudIcon: { fontSize: 18, marginHorizontal: 4 },
  hudNum: { color: '#ffd54a', fontSize: 22, fontWeight: '900', letterSpacing: 2, marginHorizontal: 4, fontVariant: ['tabular-nums'] },

  msgWrap: { position: 'absolute', top: H * 0.26, left: 0, right: 0, alignItems: 'center' },
  msgTxt: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 2 },

  overlay: { ...absFill(), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,14,30,0.8)', paddingHorizontal: 28 },
  goTitle: { color: '#ff6b6b', fontSize: 34, fontWeight: '900', letterSpacing: 1, marginBottom: 22 },
  goStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  goStatCol: { alignItems: 'center', paddingHorizontal: 24 },
  goStatVal: { color: '#fff', fontSize: 36, fontWeight: '900', fontVariant: ['tabular-nums'] },
  goStatLbl: { color: '#a9c6ec', fontSize: 12, letterSpacing: 2, fontWeight: '700', marginTop: 2 },
  goDivider: { width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.2)' },
  newBest: { color: '#ffd54a', fontSize: 18, fontWeight: '900', marginBottom: 18 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4,10,24,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#10203f', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 30, maxHeight: H * 0.9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modalHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 16 },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 18 },
  fieldLabel: { color: '#a9c6ec', fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  nameInput: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },

  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  themeChip: { width: (W - 48 - 30) / 2, borderRadius: 14, borderWidth: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  themePreview: { height: 46, flexDirection: 'column', position: 'relative' },
  themeDot: { position: 'absolute', right: 8, bottom: 6, width: 14, height: 14, borderRadius: 3 },
  themeLabel: { color: '#dce6f7', fontSize: 14, fontWeight: '800', paddingVertical: 8, paddingHorizontal: 10 },

  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  settingLabel: { color: '#e6eefb', fontSize: 16, fontWeight: '700' },
  toggle: { width: 56, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#4cd6c4' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignSelf: 'flex-start' },
  knobOn: { alignSelf: 'flex-end' },
  segment: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 4, gap: 4 },
  segItem: { flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center' },
  segItemOn: { backgroundColor: '#ff8a3d' },
  segTxt: { color: '#aebbd3', fontSize: 15, fontWeight: '800' },
  segTxtOn: { color: '#231405' },
  statsBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingVertical: 16 },
  statsItem: { alignItems: 'center', paddingHorizontal: 28 },
  statsVal: { color: '#fff', fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statsLbl: { color: '#a9c6ec', fontSize: 12, marginTop: 4, fontWeight: '700' },
  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  resetBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,107,107,0.5)', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  resetTxt: { color: '#ff8b8b', fontSize: 15, fontWeight: '800' },
  closeBtn: { flex: 2, backgroundColor: '#4cd6c4', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  closeTxt: { color: '#06231f', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  winGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: BLOCK * 0.1, justifyContent: 'space-between', alignContent: 'space-between' },
  winFrame: { width: '28%', height: '40%', padding: 1.5, borderRadius: 1 },

  bgWindows: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 4, gap: 4, opacity: 0.5 },
  bgWindow: { width: 4, height: 6 },
});

function absFill() {
  return { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 };
}
