import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppAudioProvider } from "@/components/game/AppAudioProvider";
import { AUDIO_SETTINGS_STORAGE_KEY } from "@/lib/audio/audio-settings-storage";
import { createAudioSettingsStore } from "./audio-settings-store";
import type { AudioPlaybackController, UiSoundKind } from "@/lib/audio/audio-playback";

function memoryStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    value: (key: string) => values.get(key),
  };
}

interface FakePlayback extends AudioPlaybackController {
  readonly calls: string[];
}

function fakePlayback(errors?: Partial<Record<"bgm" | UiSoundKind, Error>>): FakePlayback {
  const calls: string[] = [];
  return {
    calls,
    async playBgm() {
      calls.push("play-bgm");
      if (errors?.bgm !== undefined) throw errors.bgm;
    },
    pauseBgm() { calls.push("pause-bgm"); },
    async playUiSound(kind) {
      calls.push(`play-${kind}`);
      if (errors?.[kind] !== undefined) throw errors[kind];
    },
    dispose() { calls.push("dispose"); },
  };
}

describe("전역 오디오 설정 Store", () => {
  it("빈 저장소를 기본 OFF V1으로 hydrate한다", () => {
    const store = createAudioSettingsStore();
    store.getState().attachPlayback(fakePlayback());
    store.getState().hydrate(memoryStorage());

    expect(store.getState()).toMatchObject({
      settings: { version: 1, bgmEnabled: false, sfxEnabled: false },
      status: "ready",
      message: null,
    });
  });

  it("BGM을 켜면 재생 성공 뒤 설정을 저장하고 끄면 pause한다", async () => {
    const storage = memoryStorage();
    const playback = fakePlayback();
    const store = createAudioSettingsStore();
    store.getState().attachPlayback(playback);
    store.getState().hydrate(storage);

    await store.getState().toggleBgm();
    expect(playback.calls).toEqual(["play-bgm"]);
    expect(store.getState().settings.bgmEnabled).toBe(true);
    expect(storage.value(AUDIO_SETTINGS_STORAGE_KEY)).toBe(JSON.stringify({
      version: 1,
      bgmEnabled: true,
      sfxEnabled: false,
    }));

    await store.getState().toggleBgm();
    expect(playback.calls).toEqual(["play-bgm", "pause-bgm"]);
    expect(store.getState().settings.bgmEnabled).toBe(false);
  });

  it("효과음을 켤 때 menu 미리듣기를 재생하고 설정을 저장한다", async () => {
    const storage = memoryStorage();
    const playback = fakePlayback();
    const store = createAudioSettingsStore();
    store.getState().attachPlayback(playback);
    store.getState().hydrate(storage);

    await store.getState().toggleSfx();

    expect(playback.calls).toEqual(["play-menu"]);
    expect(store.getState().settings.sfxEnabled).toBe(true);
    expect(storage.value(AUDIO_SETTINGS_STORAGE_KEY)).toContain('"sfxEnabled":true');
  });

  it("저장된 BGM ON은 사용자 제스처 전까지 기다리고 한 번만 재생한다", async () => {
    const playback = fakePlayback();
    const store = createAudioSettingsStore();
    store.getState().attachPlayback(playback);
    store.getState().hydrate(memoryStorage({
      [AUDIO_SETTINGS_STORAGE_KEY]: JSON.stringify({
        version: 1,
        bgmEnabled: true,
        sfxEnabled: false,
      }),
    }));

    expect(playback.calls).toEqual([]);
    expect(store.getState().message).toBe("BGM 재생 대기");

    await store.getState().resumeBgmFromGesture();
    await store.getState().resumeBgmFromGesture();
    expect(playback.calls).toEqual(["play-bgm"]);
    expect(store.getState().message).toBeNull();
  });

  it("브라우저가 멈춘 BGM은 탭이 다시 보일 때 ON 설정에 맞춰 재시도한다", async () => {
    const playback = fakePlayback();
    const store = createAudioSettingsStore();
    store.getState().attachPlayback(playback);
    store.getState().hydrate(memoryStorage());

    await store.getState().toggleBgm();
    await store.getState().resumeBgmAfterVisibility();

    expect(playback.calls).toEqual(["play-bgm", "play-bgm"]);
    expect(store.getState().settings.bgmEnabled).toBe(true);
  });

  it("BGM 재생 실패는 설정을 OFF로 저장한다", async () => {
    const storage = memoryStorage();
    const store = createAudioSettingsStore();
    store.getState().attachPlayback(fakePlayback({ bgm: new Error("blocked") }));
    store.getState().hydrate(storage);

    await store.getState().toggleBgm();

    expect(store.getState()).toMatchObject({
      settings: { bgmEnabled: false },
      message: "BGM을 재생할 수 없습니다.",
    });
    expect(storage.value(AUDIO_SETTINGS_STORAGE_KEY)).toContain('"bgmEnabled":false');
  });

  it("효과음 재생 실패는 한 번만 시도하고 설정을 OFF로 저장한다", async () => {
    const storage = memoryStorage();
    const playback = fakePlayback({ menu: new Error("decode failed") });
    const store = createAudioSettingsStore();
    store.getState().attachPlayback(playback);
    store.getState().hydrate(storage);

    await store.getState().toggleSfx();
    await store.getState().playUiSound("menu");

    expect(playback.calls).toEqual(["play-menu"]);
    expect(store.getState()).toMatchObject({
      settings: { sfxEnabled: false },
      message: "효과음을 재생할 수 없습니다.",
    });
    expect(storage.value(AUDIO_SETTINGS_STORAGE_KEY)).toContain('"sfxEnabled":false');
  });

  it("미래 버전은 메모리에서 토글해도 저장 원문을 덮어쓰지 않는다", async () => {
    const raw = JSON.stringify({ version: 2, bgmEnabled: true, sfxEnabled: true });
    const storage = memoryStorage({ [AUDIO_SETTINGS_STORAGE_KEY]: raw });
    const store = createAudioSettingsStore();
    store.getState().attachPlayback(fakePlayback());
    store.getState().hydrate(storage);

    await store.getState().toggleBgm();
    await store.getState().toggleSfx();

    expect(store.getState().settings).toEqual({
      version: 1,
      bgmEnabled: true,
      sfxEnabled: true,
    });
    expect(storage.value(AUDIO_SETTINGS_STORAGE_KEY)).toBe(raw);
  });

  it("Provider는 자식 주위에 DOM wrapper를 추가하지 않는다", () => {
    const html = renderToStaticMarkup(createElement(
      AppAudioProvider,
      null,
      createElement("main", { "data-audio-child": "true" }),
    ));

    expect(html).toBe('<main data-audio-child="true"></main>');
  });
});
