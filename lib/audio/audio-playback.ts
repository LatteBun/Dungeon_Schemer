export type UiSoundKind = "select" | "menu";

export interface AudioElementPort {
  currentTime: number;
  loop: boolean;
  volume: number;
  play(): Promise<void>;
  pause(): void;
  dispose?(): void;
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
      if (elements.bgm.dispose === undefined) {
        elements.bgm.pause();
      } else {
        elements.bgm.dispose();
      }
      elements.select.pause();
      elements.menu.pause();
    },
  };
}

function createSampleAccurateBgmPlayback(): AudioElementPort {
  let context: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;
  let bufferPromise: Promise<AudioBuffer> | null = null;
  let source: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;
  let startPromise: Promise<void> | null = null;
  let startedAt = 0;
  let offset = 0;
  let loop = false;
  let volume = 1;
  let disposed = false;
  let shouldPlay = false;

  function getContext() {
    context ??= new AudioContext();
    return context;
  }

  function loadBuffer(audioContext: AudioContext) {
    bufferPromise ??= fetch(BGM_SRC)
      .then(async (response) => {
        if (!response.ok) throw new Error(`BGM을 불러올 수 없습니다: ${response.status}`);
        return audioContext.decodeAudioData(await response.arrayBuffer());
      })
      .catch((error: unknown) => {
        bufferPromise = null;
        throw error;
      });
    return bufferPromise;
  }

  const playback: AudioElementPort = {
    get currentTime() {
      return offset;
    },
    set currentTime(nextOffset) {
      offset = Math.max(0, nextOffset);
    },
    get loop() {
      return loop;
    },
    set loop(nextLoop) {
      loop = nextLoop;
      if (source !== null) source.loop = nextLoop;
    },
    get volume() {
      return volume;
    },
    set volume(nextVolume) {
      volume = nextVolume;
      if (gain !== null) gain.gain.value = nextVolume;
    },
    async play() {
      if (disposed) throw new Error("이미 정리된 BGM 재생기입니다.");
      shouldPlay = true;
      const audioContext = getContext();
      if (audioContext.state === "suspended") await audioContext.resume();
      if (source !== null) return;
      if (startPromise !== null) return startPromise;

      startPromise = (async () => {
        buffer = await loadBuffer(audioContext);
        if (!shouldPlay || disposed || source !== null) return;

        if (gain === null) {
          gain = audioContext.createGain();
          gain.connect(audioContext.destination);
        }
        gain.gain.value = volume;

        const nextSource = audioContext.createBufferSource();
        nextSource.buffer = buffer;
        nextSource.loop = loop;
        nextSource.connect(gain);
        startedAt = audioContext.currentTime;
        source = nextSource;
        nextSource.start(0, offset % buffer.duration);
      })();

      try {
        await startPromise;
      } finally {
        startPromise = null;
      }
    },
    pause() {
      shouldPlay = false;
      if (source === null || context === null || buffer === null) return;
      offset = (offset + context.currentTime - startedAt) % buffer.duration;
      source.stop();
      source.disconnect();
      source = null;
    },
    dispose() {
      playback.pause();
      disposed = true;
      gain?.disconnect();
      if (context !== null) void context.close();
    },
  };

  return playback;
}

export function createBrowserAudioPlayback(): AudioPlaybackController {
  return createAudioPlaybackController({
    bgm: createSampleAccurateBgmPlayback(),
    select: new Audio(SELECT_SRC),
    menu: new Audio(MENU_SRC),
  });
}
