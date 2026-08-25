import { createStore } from "zustand/vanilla";
import { createDefaultAudioSettings } from "@/lib/audio/audio-settings";
import {
  loadAudioSettings,
  saveAudioSettings,
} from "@/lib/audio/audio-settings-storage";
import type { AudioSettingsV1 } from "@/lib/audio/audio-settings";
import type { StringStorage } from "@/lib/audio/audio-settings-storage";
import type { AudioPlaybackController, UiSoundKind } from "@/lib/audio/audio-playback";

export interface AudioSettingsStoreState {
  readonly settings: AudioSettingsV1;
  readonly status: "loading" | "ready" | "recovered" | "unavailable";
  readonly message: string | null;
  attachPlayback(playback: AudioPlaybackController): void;
  hydrate(storage: StringStorage): void;
  resumeBgmFromGesture(): Promise<void>;
  resumeBgmAfterVisibility(): Promise<void>;
  toggleBgm(): Promise<void>;
  toggleSfx(): Promise<void>;
  playUiSound(kind: UiSoundKind): Promise<void>;
}

export type AudioSettingsStore = ReturnType<typeof createAudioSettingsStore>;

export function createAudioSettingsStore() {
  let storage: StringStorage | null = null;
  let playback: AudioPlaybackController | null = null;
  let storageWritable = true;
  let futureVersionBlocked = false;
  let bgmPlaying = false;
  let sfxFailed = false;

  return createStore<AudioSettingsStoreState>((set, get) => {
    function persist(settings: AudioSettingsV1) {
      if (storage === null || !storageWritable || futureVersionBlocked) return;
      const result = saveAudioSettings(storage, settings);
      if (!result.ok) {
        storageWritable = false;
        set({ status: "unavailable", message: result.reason });
      }
    }

    function updateSettings(settings: AudioSettingsV1, message: string | null = null) {
      set({ settings, message });
      persist(settings);
    }

    function failBgm() {
      bgmPlaying = false;
      const settings = { ...get().settings, bgmEnabled: false };
      updateSettings(settings, "BGM을 재생할 수 없습니다.");
    }

    async function playEnabledUiSound(kind: UiSoundKind) {
      if (!get().settings.sfxEnabled || sfxFailed || playback === null) return;
      try {
        await playback.playUiSound(kind);
      } catch {
        sfxFailed = true;
        const settings = { ...get().settings, sfxEnabled: false };
        updateSettings(settings, "효과음을 재생할 수 없습니다.");
      }
    }

    return {
      settings: createDefaultAudioSettings(),
      status: "loading",
      message: null,

      attachPlayback(nextPlayback) {
        playback = nextPlayback;
      },

      hydrate(nextStorage) {
        storage = nextStorage;
        storageWritable = true;
        futureVersionBlocked = false;
        bgmPlaying = false;
        sfxFailed = false;
        const result = loadAudioSettings(nextStorage);

        switch (result.status) {
          case "empty":
          case "ready":
            set({
              settings: result.settings,
              status: "ready",
              message: result.settings.bgmEnabled ? "BGM 재생 대기" : null,
            });
            return;
          case "recovered":
            set({
              settings: result.settings,
              status: "recovered",
              message: "손상된 오디오 설정을 기본값으로 복구했습니다.",
            });
            return;
          case "unavailable":
            storageWritable = false;
            futureVersionBlocked = result.raw !== undefined;
            set({
              settings: result.settings,
              status: "unavailable",
              message: result.reason,
            });
        }
      },

      async resumeBgmFromGesture() {
        if (!get().settings.bgmEnabled || bgmPlaying || playback === null) return;
        try {
          await playback.playBgm();
          bgmPlaying = true;
          set({ message: null });
        } catch {
          failBgm();
        }
      },

      async resumeBgmAfterVisibility() {
        if (!get().settings.bgmEnabled || playback === null) return;
        try {
          await playback.playBgm();
          bgmPlaying = true;
          set({ message: null });
        } catch {
          failBgm();
        }
      },

      async toggleBgm() {
        const current = get().settings;
        if (current.bgmEnabled) {
          await playEnabledUiSound("menu");
          playback?.pauseBgm();
          bgmPlaying = false;
          updateSettings({ ...get().settings, bgmEnabled: false });
          return;
        }

        if (playback === null) {
          failBgm();
          return;
        }
        try {
          await playback.playBgm();
          bgmPlaying = true;
          updateSettings({ ...get().settings, bgmEnabled: true });
          await playEnabledUiSound("menu");
        } catch {
          failBgm();
        }
      },

      async toggleSfx() {
        if (get().settings.sfxEnabled) {
          await playEnabledUiSound("menu");
          updateSettings({ ...get().settings, sfxEnabled: false });
          return;
        }

        sfxFailed = false;
        updateSettings({ ...get().settings, sfxEnabled: true });
        await playEnabledUiSound("menu");
      },

      async playUiSound(kind) {
        await playEnabledUiSound(kind);
      },
    };
  });
}
