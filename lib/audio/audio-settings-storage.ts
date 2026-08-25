import { createDefaultAudioSettings } from "./audio-settings";
import type { AudioSettingsV1 } from "./audio-settings";

export const AUDIO_SETTINGS_STORAGE_KEY = "dungeon-schemer.audio-settings.v1";

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StorageOwner {
  readonly localStorage: StringStorage;
}

export type AudioSettingsLoadResult =
  | { readonly status: "empty" | "ready"; readonly settings: AudioSettingsV1 }
  | { readonly status: "recovered"; readonly settings: AudioSettingsV1; readonly raw: string }
  | {
    readonly status: "unavailable";
    readonly settings: AudioSettingsV1;
    readonly reason: string;
    readonly raw?: string;
  };

export type AudioSettingsStorageResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

const SETTINGS_KEYS = ["version", "bgmEnabled", "sfxEnabled"] as const;

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unavailableStorage(error: unknown): StringStorage {
  return {
    getItem() { throw error; },
    setItem() { throw error; },
    removeItem() { throw error; },
  };
}

export function acquireAudioSettingsStorage(owner: unknown): StringStorage {
  try {
    const storage = (owner as StorageOwner).localStorage;
    if (storage === undefined || storage === null) {
      throw new TypeError("localStorage is unavailable");
    }
    return storage;
  } catch (error) {
    return unavailableStorage(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAudioSettingsV1(value: unknown): value is AudioSettingsV1 {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== SETTINGS_KEYS.length || !keys.every((key) => SETTINGS_KEYS.includes(
    key as (typeof SETTINGS_KEYS)[number],
  ))) {
    return false;
  }
  return value.version === 1
    && typeof value.bgmEnabled === "boolean"
    && typeof value.sfxEnabled === "boolean";
}

export function loadAudioSettings(storage: StringStorage): AudioSettingsLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
  } catch (error) {
    return {
      status: "unavailable",
      settings: createDefaultAudioSettings(),
      reason: reasonFor(error),
    };
  }

  if (raw === null) {
    return { status: "empty", settings: createDefaultAudioSettings() };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && typeof parsed.version === "number" && parsed.version > 1) {
      return {
        status: "unavailable",
        settings: createDefaultAudioSettings(),
        reason: `Unsupported audio settings version ${parsed.version}`,
        raw,
      };
    }
    if (isAudioSettingsV1(parsed)) {
      return { status: "ready", settings: parsed };
    }
  } catch {
    return { status: "recovered", settings: createDefaultAudioSettings(), raw };
  }

  return { status: "recovered", settings: createDefaultAudioSettings(), raw };
}

export function saveAudioSettings(
  storage: StringStorage,
  settings: AudioSettingsV1,
): AudioSettingsStorageResult {
  try {
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: reasonFor(error) };
  }
}
