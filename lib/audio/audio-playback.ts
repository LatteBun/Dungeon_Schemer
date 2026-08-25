export type UiSoundKind = "select" | "menu";

export interface AudioElementPort {
  currentTime: number;
  loop: boolean;
  volume: number;
  play(): Promise<void>;
  pause(): void;
}

export interface AudioPlaybackController {
  playBgm(): Promise<void>;
  pauseBgm(): void;
  playUiSound(kind: UiSoundKind): Promise<void>;
  dispose(): void;
}

interface AudioElements {
  readonly bgm: AudioElementPort;
  readonly select: AudioElementPort;
  readonly menu: AudioElementPort;
}

const BGM_VOLUME = 0.25;
const UI_VOLUME = 0.28;
const BGM_SRC = "/assets/audio/dungeon-schemer-guild-loop.wav";
const SELECT_SRC = "/assets/audio/ui-select.wav";
const MENU_SRC = "/assets/audio/ui-menu.wav";

export function createAudioPlaybackController(elements: AudioElements): AudioPlaybackController {
  elements.bgm.loop = true;
  elements.bgm.volume = BGM_VOLUME;
  elements.select.volume = UI_VOLUME;
  elements.menu.volume = UI_VOLUME;

  return {
    async playBgm() {
      await elements.bgm.play();
    },
    pauseBgm() {
      elements.bgm.pause();
    },
    async playUiSound(kind) {
      const element = elements[kind];
      element.currentTime = 0;
      await element.play();
    },
    dispose() {
      elements.bgm.pause();
      elements.select.pause();
      elements.menu.pause();
    },
  };
}

export function createBrowserAudioPlayback(): AudioPlaybackController {
  return createAudioPlaybackController({
    bgm: new Audio(BGM_SRC),
    select: new Audio(SELECT_SRC),
    menu: new Audio(MENU_SRC),
  });
}
