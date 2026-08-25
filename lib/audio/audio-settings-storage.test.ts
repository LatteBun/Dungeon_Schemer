import { describe, expect, it } from "vitest";
import { createDefaultAudioSettings } from "./audio-settings";
import {
  AUDIO_SETTINGS_STORAGE_KEY,
  acquireAudioSettingsStorage,
  loadAudioSettings,
  saveAudioSettings,
} from "./audio-settings-storage";

function memoryStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    value: (key: string) => values.get(key),
  };
}

describe("오디오 설정 저장소", () => {
  it("저장값이 없으면 BGM과 효과음이 꺼진 V1을 돌려준다", () => {
    expect(loadAudioSettings(memoryStorage())).toEqual({
      status: "empty",
      settings: { version: 1, bgmEnabled: false, sfxEnabled: false },
    });
  });

  it("정확한 V1 설정만 ready로 읽는다", () => {
    const storage = memoryStorage({
      [AUDIO_SETTINGS_STORAGE_KEY]: JSON.stringify({
        version: 1,
        bgmEnabled: true,
        sfxEnabled: false,
      }),
    });

    expect(loadAudioSettings(storage)).toEqual({
      status: "ready",
      settings: { version: 1, bgmEnabled: true, sfxEnabled: false },
    });
  });

  it.each([
    ["깨진 JSON", "{broken"],
    ["extra key", JSON.stringify({
      version: 1,
      bgmEnabled: false,
      sfxEnabled: false,
      volume: 1,
    })],
    ["boolean이 아닌 BGM", JSON.stringify({
      version: 1,
      bgmEnabled: "yes",
      sfxEnabled: false,
    })],
    ["boolean이 아닌 효과음", JSON.stringify({
      version: 1,
      bgmEnabled: false,
      sfxEnabled: 1,
    })],
    ["과거 버전", JSON.stringify({
      version: 0,
      bgmEnabled: true,
      sfxEnabled: true,
    })],
  ])("%s은 원문을 보존하고 기본값으로 복구한다", (_name, raw) => {
    expect(loadAudioSettings(memoryStorage({
      [AUDIO_SETTINGS_STORAGE_KEY]: raw,
    }))).toEqual({
      status: "recovered",
      settings: createDefaultAudioSettings(),
      raw,
    });
  });

  it("미래 버전은 덮어쓸 수 없는 상태로 돌려준다", () => {
    const raw = JSON.stringify({ version: 2, bgmEnabled: true, sfxEnabled: true });

    expect(loadAudioSettings(memoryStorage({
      [AUDIO_SETTINGS_STORAGE_KEY]: raw,
    }))).toEqual({
      status: "unavailable",
      settings: createDefaultAudioSettings(),
      reason: "Unsupported audio settings version 2",
      raw,
    });
  });

  it("localStorage getter와 읽기 예외를 저장 불가 상태로 바꾼다", () => {
    const getterError = new Error("localStorage blocked");
    const owner = Object.defineProperty({}, "localStorage", {
      get() { throw getterError; },
    });

    expect(loadAudioSettings(acquireAudioSettingsStorage(owner))).toEqual({
      status: "unavailable",
      settings: createDefaultAudioSettings(),
      reason: getterError.message,
    });

    const readError = new Error("storage read blocked");
    const storage = { ...memoryStorage(), getItem: () => { throw readError; } };
    expect(loadAudioSettings(storage)).toEqual({
      status: "unavailable",
      settings: createDefaultAudioSettings(),
      reason: readError.message,
    });
  });

  it("정상 설정을 고정 키에 저장하고 쓰기 예외를 결과로 돌려준다", () => {
    const storage = memoryStorage();
    const settings = { version: 1, bgmEnabled: true, sfxEnabled: false } as const;

    expect(saveAudioSettings(storage, settings)).toEqual({ ok: true });
    expect(storage.value(AUDIO_SETTINGS_STORAGE_KEY)).toBe(JSON.stringify(settings));

    const writeError = new Error("storage write blocked");
    const throwingStorage = {
      ...memoryStorage(),
      setItem: () => { throw writeError; },
    };
    expect(saveAudioSettings(throwingStorage, settings)).toEqual({
      ok: false,
      reason: writeError.message,
    });
  });
});
