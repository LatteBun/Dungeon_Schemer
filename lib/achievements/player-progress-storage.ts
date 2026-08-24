import { ACHIEVEMENT_CATALOG, createEmptyPlayerProgress } from "./player-progress";
import { ENDING_ORDER } from "@/lib/domain";
import type { AchievementId, PlayerProgressV1 } from "./player-progress";

export const PLAYER_PROGRESS_STORAGE_KEY = "dungeon-schemer.player-progress.v1";
export const PLAYER_PROGRESS_BACKUP_KEY = "dungeon-schemer.player-progress.corrupt-backup";

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ProgressLoadResult =
  | { readonly status: "ready" | "empty"; readonly progress: PlayerProgressV1 }
  | { readonly status: "recovered"; readonly progress: PlayerProgressV1; readonly corruptRaw: string }
  | { readonly status: "unavailable"; readonly progress: PlayerProgressV1; readonly reason: string };

export type StorageResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

const TOTAL_KEYS = [
  "completedCampaigns",
  "expeditions",
  "clearedExpeditions",
  "wipedExpeditions",
  "deaths",
  "advices",
] as const;

const PROGRESS_KEYS = ["version", "totals", "endingCounts", "unlocked", "recordedRunIds"] as const;
const ACHIEVEMENT_IDS = new Set<AchievementId>(ACHIEVEMENT_CATALOG.map(({ id }) => id));

function reasonFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isCanonicalIsoString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isPlayerProgressV1(value: unknown): value is PlayerProgressV1 {
  if (!isRecord(value) || !hasExactlyKeys(value, PROGRESS_KEYS) || value.version !== 1) return false;
  if (!isRecord(value.totals) || !hasExactlyKeys(value.totals, TOTAL_KEYS)) return false;
  const totals = value.totals;
  if (!TOTAL_KEYS.every((key) => isNonNegativeSafeInteger(totals[key]))) return false;

  if (!isRecord(value.endingCounts) || !hasExactlyKeys(value.endingCounts, ENDING_ORDER)) return false;
  const endingCounts = value.endingCounts;
  if (!ENDING_ORDER.every((ending) => isNonNegativeSafeInteger(endingCounts[ending]))) return false;

  if (!isRecord(value.unlocked)) return false;
  if (!Object.keys(value.unlocked).every((id) => ACHIEVEMENT_IDS.has(id as AchievementId))) return false;
  if (!Object.values(value.unlocked).every(
    (unlock) => isRecord(unlock) && hasExactlyKeys(unlock, ["unlockedAt"]) && isCanonicalIsoString(unlock.unlockedAt),
  )) {
    return false;
  }

  if (!Array.isArray(value.recordedRunIds)) return false;
  if (!value.recordedRunIds.every((runId) => typeof runId === "string" && runId.length > 0)) return false;
  return new Set(value.recordedRunIds).size === value.recordedRunIds.length;
}

export function loadPlayerProgress(storage: StringStorage): ProgressLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(PLAYER_PROGRESS_STORAGE_KEY);
  } catch (error) {
    return { status: "unavailable", progress: createEmptyPlayerProgress(), reason: reasonFor(error) };
  }

  if (raw === null) return { status: "empty", progress: createEmptyPlayerProgress() };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && typeof parsed.version === "number" && parsed.version > 1) {
      return {
        status: "unavailable",
        progress: createEmptyPlayerProgress(),
        reason: `Unsupported player progress version ${parsed.version}`,
      };
    }
    if (isPlayerProgressV1(parsed)) return { status: "ready", progress: parsed };
  } catch {
    return { status: "recovered", progress: createEmptyPlayerProgress(), corruptRaw: raw };
  }

  return { status: "recovered", progress: createEmptyPlayerProgress(), corruptRaw: raw };
}

export function savePlayerProgress(
  storage: StringStorage,
  progress: PlayerProgressV1,
  corruptRaw?: string,
): StorageResult {
  if (corruptRaw !== undefined) {
    try {
      if (storage.getItem(PLAYER_PROGRESS_BACKUP_KEY) === null) {
        storage.setItem(PLAYER_PROGRESS_BACKUP_KEY, corruptRaw);
      }
    } catch {
      // The replacement V1 data is still more useful than an unavailable backup.
    }
  }

  try {
    storage.setItem(PLAYER_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: reasonFor(error) };
  }
}

export function clearPlayerProgress(storage: StringStorage): StorageResult {
  try {
    storage.removeItem(PLAYER_PROGRESS_STORAGE_KEY);
    storage.removeItem(PLAYER_PROGRESS_BACKUP_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: reasonFor(error) };
  }
}
