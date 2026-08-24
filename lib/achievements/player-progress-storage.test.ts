import { describe, expect, it } from "vitest";
import { createEmptyPlayerProgress, recordCompletedCampaign } from "./player-progress";
import {
  PLAYER_PROGRESS_BACKUP_KEY,
  PLAYER_PROGRESS_STORAGE_KEY,
  clearPlayerProgress,
  loadPlayerProgress,
  savePlayerProgress,
} from "./player-progress-storage";
import type { PlayerProgressV1 } from "./player-progress";

function memoryStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    value: (key: string) => values.get(key),
  };
}

describe("플레이어 업적 저장소", () => {
  it("값이 없으면 빈 프로필을 돌려준다", () => {
    expect(loadPlayerProgress(memoryStorage())).toMatchObject({
      status: "empty",
      progress: createEmptyPlayerProgress(),
    });
  });

  it("손상된 V1은 원문과 빈 프로필을 함께 돌려준다", () => {
    const storage = memoryStorage({ "dungeon-schemer.player-progress.v1": "{broken" });

    expect(loadPlayerProgress(storage)).toMatchObject({
      status: "recovered",
      corruptRaw: "{broken",
      progress: createEmptyPlayerProgress(),
    });
  });

  it("미래 버전을 덮어쓸 수 있는 값으로 해석하지 않는다", () => {
    const storage = memoryStorage({
      "dungeon-schemer.player-progress.v1": JSON.stringify({ version: 2 }),
    });

    expect(loadPlayerProgress(storage).status).toBe("unavailable");
  });
});

function validProgress(): PlayerProgressV1 {
  return recordCompletedCampaign(createEmptyPlayerProgress(), {
    runId: "run-1",
    ending: "completed",
    finalRank: "S",
    totalExpeditions: 15,
    clearedExpeditions: 15,
    wipedExpeditions: 0,
    deaths: 0,
    advices: 100,
  }, "2026-08-24T10:00:00.000Z");
}

function invalidRaw(change: (value: Record<string, unknown>) => void): string {
  const value = JSON.parse(JSON.stringify(validProgress())) as Record<string, unknown>;
  change(value);
  return JSON.stringify(value);
}

describe("플레이어 업적 저장소의 V1 경계", () => {
  it("정확한 V1만 ready로 읽는다", () => {
    const storage = memoryStorage({
      [PLAYER_PROGRESS_STORAGE_KEY]: JSON.stringify(validProgress()),
    });

    expect(loadPlayerProgress(storage)).toEqual({ status: "ready", progress: validProgress() });
  });

  it.each([
    ["중복 run ID", invalidRaw((value) => { value.recordedRunIds = ["run-1", "run-1"]; })],
    ["음수 카운터", invalidRaw((value) => {
      (value.totals as Record<string, unknown>).advices = -1;
    })],
    ["소수 카운터", invalidRaw((value) => {
      (value.endingCounts as Record<string, unknown>).completed = 1.5;
    })],
    ["알 수 없는 엔딩 키", invalidRaw((value) => {
      (value.endingCounts as Record<string, unknown>).unknown = 1;
    })],
    ["알 수 없는 업적 ID", invalidRaw((value) => {
      (value.unlocked as Record<string, unknown>).unknown = { unlockedAt: "2026-08-24T10:00:00.000Z" };
    })],
    ["정규화되지 않은 ISO", invalidRaw((value) => {
      (value.unlocked as Record<string, { unlockedAt: string }>)["first-record"] = {
        unlockedAt: "2026-08-24T10:00:00Z",
      };
    })],
  ])("%s는 손상된 값으로 복구한다", (_name, raw) => {
    const storage = memoryStorage({ [PLAYER_PROGRESS_STORAGE_KEY]: raw });

    expect(loadPlayerProgress(storage)).toMatchObject({ status: "recovered", corruptRaw: raw });
  });

  it("손상 원문은 한 번만 백업하고 새 V1을 저장한다", () => {
    const storage = memoryStorage();
    const corruptRaw = "{broken";

    expect(savePlayerProgress(storage, validProgress(), corruptRaw)).toEqual({ ok: true });
    expect(storage.value(PLAYER_PROGRESS_BACKUP_KEY)).toBe(corruptRaw);
    expect(storage.value(PLAYER_PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(validProgress()));

    expect(savePlayerProgress(storage, createEmptyPlayerProgress(), "{newer")).toEqual({ ok: true });
    expect(storage.value(PLAYER_PROGRESS_BACKUP_KEY)).toBe(corruptRaw);
  });

  it("저장 예외를 결과로 돌리고 백업 예외는 무시한다", () => {
    const writeError = new Error("storage write blocked");
    const throwingWriteStorage = {
      ...memoryStorage(),
      setItem: () => { throw writeError; },
    };
    const backupFailingStorage = {
      ...memoryStorage(),
      setItem: (key: string, value: string) => {
        if (key === PLAYER_PROGRESS_BACKUP_KEY) throw new Error("backup blocked");
        memory.set(key, value);
      },
    };
    const memory = new Map<string, string>();

    expect(savePlayerProgress(throwingWriteStorage, validProgress())).toEqual({
      ok: false,
      reason: writeError.message,
    });
    expect(savePlayerProgress(backupFailingStorage, validProgress(), "{broken")).toEqual({ ok: true });
    expect(memory.get(PLAYER_PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(validProgress()));
  });

  it("읽기 예외는 저장 불가 상태로 바꾼다", () => {
    const error = new Error("storage read blocked");
    const storage = { ...memoryStorage(), getItem: () => { throw error; } };

    expect(loadPlayerProgress(storage)).toEqual({
      status: "unavailable",
      progress: createEmptyPlayerProgress(),
      reason: error.message,
    });
  });

  it("초기화는 두 고정 키만 지우고 제거 예외를 결과로 돌린다", () => {
    const storage = memoryStorage({
      [PLAYER_PROGRESS_STORAGE_KEY]: JSON.stringify(validProgress()),
      [PLAYER_PROGRESS_BACKUP_KEY]: "{broken",
      "unrelated-key": "keep",
    });

    expect(clearPlayerProgress(storage)).toEqual({ ok: true });
    expect(storage.value(PLAYER_PROGRESS_STORAGE_KEY)).toBeUndefined();
    expect(storage.value(PLAYER_PROGRESS_BACKUP_KEY)).toBeUndefined();
    expect(storage.value("unrelated-key")).toBe("keep");

    const error = new Error("storage remove blocked");
    const throwingStorage = { ...memoryStorage(), removeItem: () => { throw error; } };
    expect(clearPlayerProgress(throwingStorage)).toEqual({ ok: false, reason: error.message });
  });
});
