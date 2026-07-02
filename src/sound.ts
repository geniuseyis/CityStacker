import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

export type SfxName = 'drop' | 'place' | 'perfect' | 'crash' | 'click';

type Player = ReturnType<typeof createAudioPlayer>;

const sources: Record<SfxName, number> = {
  drop: require('../assets/sfx/drop.wav'),
  place: require('../assets/sfx/place.wav'),
  perfect: require('../assets/sfx/perfect.wav'),
  crash: require('../assets/sfx/crash.wav'),
  click: require('../assets/sfx/click.wav'),
};

const players: Partial<Record<SfxName, Player>> = {};
let enabled = true;
let ready = false;

let musicPlayer: Player | null = null;
let musicEnabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

export function setMusicEnabled(v: boolean) {
  musicEnabled = v;
  if (!musicPlayer) return;
  try {
    if (v) musicPlayer.play();
    else musicPlayer.pause();
  } catch {
    /* yok say */
  }
}

export function startMusic() {
  if (musicEnabled && musicPlayer) {
    try {
      musicPlayer.play();
    } catch {
      /* yok say */
    }
  }
}

export function pauseMusic() {
  try {
    musicPlayer?.pause();
  } catch {
    /* yok say */
  }
}

export async function initSound() {
  if (ready) return;
  ready = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    /* yok say */
  }
  (Object.keys(sources) as SfxName[]).forEach((k) => {
    try {
      players[k] = createAudioPlayer(sources[k]);
    } catch {
      /* yok say */
    }
  });
  try {
    musicPlayer = createAudioPlayer(require('../assets/music/bgm.wav'));
    musicPlayer.loop = true;
    musicPlayer.volume = 0.45;
  } catch {
    /* yok say */
  }
}

export function playSfx(name: SfxName) {
  if (!enabled) return;
  const p = players[name];
  if (!p) return;
  Promise.resolve(p.seekTo(0))
    .then(() => p.play())
    .catch(() => {
      /* yok say */
    });
}

export function unloadSound() {
  (Object.keys(players) as SfxName[]).forEach((k) => {
    try {
      players[k]?.remove();
    } catch {
      /* yok say */
    }
    delete players[k];
  });
  try {
    musicPlayer?.remove();
  } catch {
    /* yok say */
  }
  musicPlayer = null;
  ready = false;
}
