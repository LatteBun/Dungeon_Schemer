import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_RUN_CORRUPT_BACKUP_KEY,
  CAMPAIGN_RUN_STORAGE_KEY,
} from "@/lib/store/campaign-run-storage";
import {
  collectStorageDiagnostics,
  formatStorageDiagnostics,
  collectStorageDiagnosticsFromOwner,
  type DiagnosticStorage,
} from "./local-storage-diagnostics";

function memoryStorage(seed: Record<string, string> = {}): DiagnosticStorage {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
  };
}

function throwingStorage(error: Error): DiagnosticStorage {
  return {
    get length(): number { throw error; },
    key() { throw error; },
    getItem() { throw error; },
  };
}

const context = {
  collectedAt: "2026-08-26T12:00:00.000Z",
  userAgent: "test-agent",
};

describe("브라우저 저장 진단", () => {
  it("앱 키만 정렬하고 정상 캠페인을 요약한다", () => {
    const snapshot = collectStorageDiagnostics(memoryStorage({
      unrelated: "secret",
      "dungeon-schemer.player-progress.v1": "{broken",
      [CAMPAIGN_RUN_CORRUPT_BACKUP_KEY]: JSON.stringify({ version: 1, raw: "{broken}" }),
      [CAMPAIGN_RUN_STORAGE_KEY]: JSON.stringify({
        version: 1,
        seed: "report-seed",
        actions: [{ type: "OPEN_BOARD" }, { type: "SELECT_CONTRACT", offerId: "offer" }],
      }),
    }), context);

    expect(snapshot.entries.map(({ key }) => key)).toEqual([
      CAMPAIGN_RUN_CORRUPT_BACKUP_KEY,
      CAMPAIGN_RUN_STORAGE_KEY,
      "dungeon-schemer.player-progress.v1",
    ]);
    expect(snapshot.entries[2]).toMatchObject({ format: "invalid-json", raw: "{broken", display: "{broken" });
    expect(snapshot.campaign).toEqual({
      seed: "report-seed",
      actionCount: 2,
      latestActionType: "SELECT_CONTRACT",
    });
    expect(formatStorageDiagnostics(snapshot)).not.toContain("unrelated");
    expect(formatStorageDiagnostics(snapshot)).not.toContain("secret");
  });

  it("정상 JSON은 구조를 보존해 읽기 좋게 표시한다", () => {
    const snapshot = collectStorageDiagnostics(memoryStorage({
      "dungeon-schemer.audio-settings.v1": "{\"version\":1,\"bgmEnabled\":true}",
    }), context);

    expect(snapshot.entries[0]).toMatchObject({
      format: "json",
      raw: "{\"version\":1,\"bgmEnabled\":true}",
      display: "{\n  \"version\": 1,\n  \"bgmEnabled\": true\n}",
    });
  });

  it("저장소 접근 예외를 빈 저장으로 위장하지 않는다", () => {
    expect(collectStorageDiagnostics(throwingStorage(new Error("blocked")), context)).toEqual({
      version: 1,
      ...context,
      status: "unavailable",
      reason: "blocked",
      campaign: null,
      entries: [],
    });
  });

  it("브라우저 localStorage getter 접근 예외도 진단 상태로 바꾼다", () => {
    const owner = Object.defineProperty({}, "localStorage", {
      get() { throw new Error("getter blocked"); },
    });

    expect(collectStorageDiagnosticsFromOwner(owner, context)).toMatchObject({
      status: "unavailable",
      reason: "getter blocked",
      entries: [],
    });
  });

  it("형태가 잘못된 캠페인 JSON은 원문만 보존하고 요약하지 않는다", () => {
    const snapshot = collectStorageDiagnostics(memoryStorage({
      [CAMPAIGN_RUN_STORAGE_KEY]: JSON.stringify({ version: 1, seed: "report-seed", actions: "broken" }),
    }), context);

    expect(snapshot.status).toBe("ready");
    expect(snapshot.campaign).toBeNull();
    expect(snapshot.entries).toHaveLength(1);
  });
});
