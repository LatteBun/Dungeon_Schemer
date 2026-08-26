import { describe, expect, it } from "vitest";
import { CAMPAIGN_RUN_STORAGE_KEY, type StringStorage } from "@/lib/store/campaign-run-storage";
import {
  copyStorageDiagnostics,
  resetCampaignForDiagnostics,
  resetCampaignFromOwner,
} from "./achievement-storage-actions";

function memoryStorage(seed: Record<string, string> = {}): StringStorage {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

function stickyStorage(key: string, value: string): StringStorage {
  return {
    getItem: (candidate) => candidate === key ? value : null,
    setItem() {},
    removeItem() {},
  };
}

describe("업적 저장 진단 동작", () => {
  it("진단 문자열을 clipboard에 복사한다", async () => {
    const writes: string[] = [];

    await expect(copyStorageDiagnostics({
      writeText: async (text) => { writes.push(text); },
    }, "report")).resolves.toEqual({ ok: true });
    expect(writes).toEqual(["report"]);
  });

  it("clipboard가 거부하면 이유를 반환한다", async () => {
    await expect(copyStorageDiagnostics({
      writeText: async () => { throw new Error("clipboard blocked"); },
    }, "report")).resolves.toEqual({ ok: false, reason: "clipboard blocked" });
  });

  it("캠페인 키 삭제 성공 뒤에만 새 캠페인으로 이동한다", () => {
    const storage = memoryStorage({
      [CAMPAIGN_RUN_STORAGE_KEY]: "saved",
      "dungeon-schemer.player-progress.v1": "achievement",
      "dungeon-schemer.audio-settings.v1": "audio",
      "dungeon-schemer.player-progress.corrupt-backup": "backup",
      unrelated: "other",
    });
    const destinations: string[] = [];

    expect(resetCampaignForDiagnostics(storage, (href) => destinations.push(href))).toEqual({ ok: true });
    expect(destinations).toEqual(["/campaign"]);
    expect(storage.getItem(CAMPAIGN_RUN_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("dungeon-schemer.player-progress.v1")).toBe("achievement");
    expect(storage.getItem("dungeon-schemer.audio-settings.v1")).toBe("audio");
    expect(storage.getItem("dungeon-schemer.player-progress.corrupt-backup")).toBe("backup");
    expect(storage.getItem("unrelated")).toBe("other");
  });

  it("삭제가 실패하면 이동하지 않는다", () => {
    const destinations: string[] = [];

    expect(resetCampaignForDiagnostics(
      stickyStorage(CAMPAIGN_RUN_STORAGE_KEY, "saved"),
      (href) => destinations.push(href),
    )).toEqual({ ok: false, reason: "캠페인 저장이 남아 있다" });
    expect(destinations).toEqual([]);
  });

  it("브라우저 localStorage getter가 막히면 이동하지 않는다", () => {
    const owner = Object.defineProperty({}, "localStorage", {
      get() { throw new Error("getter blocked"); },
    });
    const destinations: string[] = [];

    expect(resetCampaignFromOwner(owner, (href) => destinations.push(href))).toEqual({
      ok: false,
      reason: "getter blocked",
    });
    expect(destinations).toEqual([]);
  });
});
