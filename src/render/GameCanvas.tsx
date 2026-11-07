import { Canvas, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { STEP, createGame, drop, predictOffset, step, type GameEvent, type GameState } from '@/engine';
import { Scene } from './scene';
import type { SkyTheme } from './themes';

type Props = {
  game: React.RefObject<GameState>;
  theme: SkyTheme;
  paused?: boolean;
  reducedMotion?: boolean;
  // ana menüdeki vitrin modu: oyunu kendi oynar
  demo?: boolean;
  // sahne ekranın bu oranına sığdırılır (ana menü: üst kısım)
  fit?: number;
  fitTop?: number;
  // nişan yardımı: tahmini iniş noktasını çiz
  guide?: boolean;
  onEvents?: (events: GameEvent[]) => void;
};

const empty = (() => {
  const r = Skia.PictureRecorder();
  r.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
  return r.finishRecordingAsPicture();
})();

export function GameCanvas({ game, theme, paused, reducedMotion, demo, fit = 1, fitTop = 0, guide, onEvents }: Props) {
  const { width, height } = useWindowDimensions();
  const picture = useSharedValue<SkPicture>(empty);
  const scene = useRef<Scene | null>(null);
  if (!scene.current) scene.current = new Scene(theme);

  const live = useRef({ paused, onEvents, width, height, demo, fit, fitTop, guide });
  live.current = { paused, onEvents, width, height, demo, fit, fitTop, guide };

  useEffect(() => {
    scene.current!.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    scene.current!.reducedMotion = !!reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let acc = 0;
    const bot = { wait: 0, aim: 0 };

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

      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 12) {
        if (L.demo) runBot(s, bot);
        step(s);
        acc -= STEP;
        n++;
      }
      if (n === 12) acc = 0;

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
        !!L.guide
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
