import { describe, expect, it } from "vitest";
import type { CampaignState } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createPlayerProgressStore } from "@/lib/store/player-progress-store";
import { recordCampaignCompletion } from "./CampaignCompletionRecorder";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function endedCampaign(seed: string): CampaignState {
  const campaign = initializeCampaign(seed);
  return {
    ...campaign,
    phase: "ended",
    ending: {
      kind: "completed",
      title: "원정 종료",
      reason: "완주",
      finalRank: "A",
      triggerCharacterIds: [],
    },
  };
}

describe("캠페인 완료 기록 effect", () => {
  it("엔딩 전 effect는 같은 mount의 업적 기록을 바꾸지 않는다", () => {
    const store = createPlayerProgressStore();
    store.getState().hydrate(memoryStorage());

    recordCampaignCompletion(
      initializeCampaign("recorder-open"),
      "mounted-run-1",
      store.getState().record,
      "2026-08-25T10:00:00.000Z",
    );

    expect(store.getState().progress.totals.completedCampaigns).toBe(0);
    expect(store.getState().progress.recordedRunIds).toEqual([]);
  });

  it("같은 mount의 엔딩 재렌더와 Strict Mode effect 반복은 한 번만 세고 별도 mount는 따로 센다", () => {
    const store = createPlayerProgressStore();
    store.getState().hydrate(memoryStorage());
    const campaign = endedCampaign("recorder-ended");
    const record = store.getState().record;

    recordCampaignCompletion(campaign, "mounted-run-1", record, "2026-08-25T10:00:00.000Z");
    recordCampaignCompletion(campaign, "mounted-run-1", record, "2026-08-25T10:00:01.000Z");
    recordCampaignCompletion({ ...campaign }, "mounted-run-1", record, "2026-08-25T10:00:02.000Z");

    expect(store.getState().progress.totals.completedCampaigns).toBe(1);
    expect(store.getState().progress.recordedRunIds).toEqual(["mounted-run-1"]);

    recordCampaignCompletion(campaign, "mounted-run-2", record, "2026-08-25T10:01:00.000Z");

    expect(store.getState().progress.totals.completedCampaigns).toBe(2);
    expect(store.getState().progress.recordedRunIds).toEqual(["mounted-run-1", "mounted-run-2"]);
  });
});
