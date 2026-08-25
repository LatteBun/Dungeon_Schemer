import { describe, expect, it } from "vitest";
import type {
  CampaignEvent,
  CampaignEventId,
  CampaignEventSourceKey,
  CampaignState,
  BossId,
  ChoiceId,
  DungeonId,
  EventId,
} from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import {
  completedCampaignRecordFor,
  createCampaignRunId,
} from "./completed-campaign";

const DUNGEON_ID = "dungeon-spider-01" as DungeonId;
const EVENT_ID = "event-spider-01" as EventId;
const ADVICE_ID = "advice-spider-01" as ChoiceId;

const adviceEvent: CampaignEvent = {
  id: "history-1" as CampaignEventId,
  campaignTurn: 1,
  sequence: 1,
  sourceKey: "expedition-1:advice:1" as CampaignEventSourceKey,
  type: "ADVICE_RESOLVED",
  expeditionId: "expedition-1",
  dungeonId: DUNGEON_ID,
  sourceEventId: EVENT_ID,
  adviceId: ADVICE_ID,
  outcome: "help",
  executed: true,
  reactions: [],
};

const bossEvent: CampaignEvent = {
  id: "history-2" as CampaignEventId,
  campaignTurn: 1,
  sequence: 2,
  sourceKey: "expedition-1:boss" as CampaignEventSourceKey,
  type: "BOSS_BATTLE_RESOLVED",
  expeditionId: "expedition-1",
  dungeonId: DUNGEON_ID,
  bossId: "boss-spider-01" as BossId,
  status: "cleared",
  survivorIds: [],
  verificationCount: 0,
};

const adviceEvent2: CampaignEvent = {
  ...adviceEvent,
  id: "history-3" as CampaignEventId,
  sequence: 3,
  sourceKey: "expedition-1:advice:2" as CampaignEventSourceKey,
};

describe("완료 캠페인 업적 기록 어댑터", () => {
  it("끝나지 않은 캠페인은 기록으로 만들지 않는다", () => {
    expect(completedCampaignRecordFor(initializeCampaign("open"), "run-open")).toBeNull();
  });

  it("규칙 통계와 해결된 조언 수만 완료 기록으로 옮긴다", () => {
    const base = initializeCampaign("ended");
    const campaign = {
      ...base,
      phase: "ended",
      ending: {
        kind: "completed",
        title: "원정 종료",
        reason: "완주",
        finalRank: "S",
        triggerCharacterIds: [],
      },
      statistics: {
        ...base.statistics,
        totalExpeditions: 17,
        clearedExpeditions: 15,
        wipedExpeditions: 2,
        totalDeaths: 3,
      },
      history: { ...base.history, events: [adviceEvent, bossEvent, adviceEvent2] },
    } as CampaignState;

    expect(completedCampaignRecordFor(campaign, "run-ended")).toEqual({
      runId: "run-ended",
      ending: "completed",
      finalRank: "S",
      totalExpeditions: 17,
      clearedExpeditions: 15,
      wipedExpeditions: 2,
      deaths: 3,
      advices: 2,
    });
  });

  it("비어 있는 캠페인 실행 ID를 거부한다", () => {
    expect(createCampaignRunId(() => "run-123")).toBe("run-123");
    expect(() => createCampaignRunId(() => "")).toThrow(TypeError);
  });
});
