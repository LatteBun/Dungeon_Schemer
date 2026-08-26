import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_RUN_CORRUPT_BACKUP_KEY,
  CAMPAIGN_RUN_STORAGE_KEY,
  CAMPAIGN_RUN_VERSION,
  type StringStorage,
} from "./campaign-run-storage";
import { restoreCampaignRun } from "./campaign-run-restore";
import { advanceRun, initialRunState } from "./campaign-run";

function memoryStorage(seed: Record<string, string> = {}): StringStorage & { readonly map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
  };
}

describe("캠페인 저장 복원", () => {
  it("replay가 실패한 저장을 격리하고 새 캠페인을 유지한다", () => {
    const opened = advanceRun(initialRunState("broken-mobile-save"), { type: "OPEN_BOARD" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const raw = JSON.stringify({
      version: CAMPAIGN_RUN_VERSION,
      seed: "broken-mobile-save",
      actions: [
        { type: "OPEN_BOARD" },
        { type: "SELECT_CONTRACT", offerId: opened.state.campaign.offers[0]!.id },
        { type: "START_EXPEDITION", expeditionId: "broken" },
      ],
    });
    const storage = memoryStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: raw });

    expect(restoreCampaignRun(storage)).toEqual({ status: "recovered" });
    expect(storage.map.has(CAMPAIGN_RUN_STORAGE_KEY)).toBe(false);
    expect(JSON.parse(storage.map.get(CAMPAIGN_RUN_CORRUPT_BACKUP_KEY)!)).toMatchObject({
      failedAt: 2,
      raw,
    });
  });

  it("정상 저장은 replay 결과와 기록을 함께 반환한다", () => {
    const raw = JSON.stringify({
      version: CAMPAIGN_RUN_VERSION,
      seed: "restored-save",
      actions: [{ type: "OPEN_BOARD" }],
    });

    const restored = restoreCampaignRun(memoryStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: raw }));

    expect(restored.status).toBe("restored");
    if (restored.status !== "restored") return;
    expect(restored.run).toEqual({
      version: CAMPAIGN_RUN_VERSION,
      seed: "restored-save",
      actions: [{ type: "OPEN_BOARD" }],
    });
    expect(restored.state.campaign.phase).toBe("board");
  });

  it("원문이 있는 쓸 수 없는 저장도 격리한다", () => {
    const storage = memoryStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: "{broken" });

    expect(restoreCampaignRun(storage)).toEqual({ status: "recovered" });
    expect(storage.map.has(CAMPAIGN_RUN_STORAGE_KEY)).toBe(false);
    expect(JSON.parse(storage.map.get(CAMPAIGN_RUN_CORRUPT_BACKUP_KEY)!)).toMatchObject({
      failedAt: null,
      raw: "{broken",
    });
  });

  it("미래 버전 저장은 진행과 기존 손상 백업을 그대로 보존한다", () => {
    const raw = JSON.stringify({
      version: CAMPAIGN_RUN_VERSION + 1,
      seed: "future-save",
      actions: [{ type: "OPEN_BOARD" }],
    });
    const previousBackup = "previous corruption backup";
    const storage = memoryStorage({
      [CAMPAIGN_RUN_STORAGE_KEY]: raw,
      [CAMPAIGN_RUN_CORRUPT_BACKUP_KEY]: previousBackup,
    });

    expect(restoreCampaignRun(storage)).toEqual({
      status: "unsupported",
      version: CAMPAIGN_RUN_VERSION + 1,
    });
    expect(storage.map.get(CAMPAIGN_RUN_STORAGE_KEY)).toBe(raw);
    expect(storage.map.get(CAMPAIGN_RUN_CORRUPT_BACKUP_KEY)).toBe(previousBackup);
  });

  it("과거 버전 저장은 미래 버전과 달리 손상 저장으로 격리한다", () => {
    const raw = JSON.stringify({ version: CAMPAIGN_RUN_VERSION - 1, seed: "legacy-save", actions: [] });
    const storage = memoryStorage({ [CAMPAIGN_RUN_STORAGE_KEY]: raw });

    expect(restoreCampaignRun(storage)).toEqual({ status: "recovered" });
    expect(storage.map.has(CAMPAIGN_RUN_STORAGE_KEY)).toBe(false);
    expect(JSON.parse(storage.map.get(CAMPAIGN_RUN_CORRUPT_BACKUP_KEY)!)).toMatchObject({
      failedAt: null,
      raw,
    });
  });
});
