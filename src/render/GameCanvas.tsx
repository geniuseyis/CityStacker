import { Canvas, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import {
  STEP,
  continueRun,
  createGame,
  drop,
  predictOffset,
  step,
  type GameEvent,
  type GameState,
  type RunRecord,
} from '@/engine';
import { Scene } from './scene';
import type { SkyTheme } from './themes';

type Props = {
  game: React.RefObject<GameState>;
  theme: SkyTheme;
  skin?: string;
  crane?: { color: string | null; dark: string | null };
  paused?: boolean;
  reducedMotion?: boolean;
  // ana menüdeki vitrin modu: oyunu kendi oynar
  demo?: boolean;
  // sahne ekranın bu oranına sığdırılır (ana menü: üst kısım)
  fit?: number;
  fitTop?: number;
  // nişan yardımı: tahmini iniş noktasını çiz
  guide?: boolean;
  // hayalet modu: bu kayıt oyuncuyla aynı adımda yeniden oynatılır
  ghost?: RunRecord | null;
  onGhostFloors?: (floors: number) => void;
  onEvents?: (events: GameEvent[]) => void;
};

const empty = (() => {
  const r = Skia.PictureRecorder();
  r.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return r.finishRecordingAsPicture();
})();

type Ghost = { s: GameState; rec: RunRecord; i: number; floors: number };

function makeGhost(rec: RunRecord): Ghost {
  return { s: createGame(rec.seed, rec.difficulty, { weather: rec.weather }), rec, i: 0, floors: 0 };
}

// hayaleti bir adım ilerlet: o adımdaki girdileri uygula, sonra adımla (replay ile aynı sıra)
function stepGhost(g: Ghost) {
  const { s, rec } = g;
  while (g.i < rec.inputs.length && rec.inputs[g.i].tick === s.tick) {
    const inp = rec.inputs[g.i++];
    if (inp.kind === 'drop') drop(s);
    else continueRun(s);
  }
  step(s);
  s.events.length = 0;
}

export function GameCanvas({
  game,
  theme,
  skin = 'classic',
  crane,
  paused,
  reducedMotion,
  demo,
  fit = 1,
  fitTop = 0,
  guide,
  ghost,
  onGhostFloors,
  onEvents,
}: Props) {
  const { width, height } = useWindowDimensions();
  const picture = useSharedValue<SkPicture>(empty);
  const scene = useRef<Scene | null>(null);
  if (!scene.current) scene.current = new Scene(theme);

  const live = useRef({ paused, onEvents, onGhostFloors, width, height, demo, fit, fitTop, guide, ghost });
  live.current = { paused, onEvents, onGhostFloors, width, height, demo, fit, fitTop, guide, ghost };

  useEffect(() => {
    scene.current!.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    scene.current!.setSkin(skin);
  }, [skin]);

  useEffect(() => {
    scene.current!.setCrane(crane?.color ?? null, crane?.dark ?? null);
  }, [crane?.color, crane?.dark]);

  useEffect(() => {
    scene.current!.reducedMotion = !!reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let acc = 0;
    const bot = { wait: 0, aim: 0 };
    let ghostRun: Ghost | null = null;
    let lastGame: GameState | null = null;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const L = live.current;
      const s = game.current;
      if (!s) return;
      if (!last) last = now;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1; // arka plandan dönüş
      if (L.paused) return;

      // yeni oyun başladıysa hayalet de baştan başlar
      if (s !== lastGame) {
        lastGame = s;
        ghostRun = L.ghost ? makeGhost(L.ghost) : null;
        if (ghostRun) L.onGhostFloors?.(0);
      }

      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 12) {
        if (L.demo) runBot(s, bot);
        step(s);
        if (ghostRun) stepGhost(ghostRun);
        acc -= STEP;
        n++;
      }
      if (n === 12) acc = 0;

      if (ghostRun && ghostRun.s.blocks.length !== ghostRun.floors) {
        ghostRun.floors = ghostRun.s.blocks.length;
        L.onGhostFloors?.(ghostRun.floors);
      }

      if (s.events.length) {
        const evs = s.events.splice(0);
        for (const ev of evs) scene.current!.onEvent(ev);
        L.onEvents?.(evs);
      }

      if (L.demo && (s.phase === 'over' || s.blocks.length >= 16)) {
        game.current = createGame((Math.random() * 1e9) | 0, 'normal');
        scene.current!.reset();
      }

      picture.value = scene.current!.render(
        game.current!,
        dt,
        L.width,
        L.height,
        L.height * L.fit - L.fitTop,
        L.fitTop,
        !!L.guide,
        ghostRun?.s ?? null
      );
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [game, picture]);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  );
}

// vitrin botu: çoğunlukla iyi, arada kusursuz bırakır
function runBot(s: GameState, bot: { wait: number; aim: number }) {
  if (s.phase !== 'swinging' || !s.cur) {
    bot.wait = 0;
    return;
  }
  if (bot.wait === 0) {
    bot.wait = s.tick + 60 + Math.floor(Math.random() * 80);
    bot.aim = Math.random() < 0.55 ? 2 : 5 + Math.random() * 9;
  }
  if (s.tick < bot.wait) return;
  // fizikle nereye ineceğini tahmin edip bırakır
  const d = predictOffset(s);
  if (d !== null && Math.abs(d) < bot.aim) {
    drop(s);
    bot.wait = 0;
  }
}
