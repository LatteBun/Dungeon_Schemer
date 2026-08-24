import { describe, expect, it } from "vitest";
import type { CampaignEnding, CampaignState } from "@/lib/domain";
import { createCampaignHistory } from "@/lib/domain";
import { appendCampaignEvent, deriveTurningPoints, toAdviceResolvedEventDraft, toBossBattleResolvedEventDraft, toTrustCollapsedEventDraft } from "@/lib/rules/campaign-history";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createU6EndingView } from "./u6-ending-adapter";

const CAMPAIGN: CampaignState = initializeCampaign("ending-adapter");

function endingOf(over: Partial<CampaignEnding> = {}): CampaignEnding {
  return {
    kind: "completed",
    title: "완주",
    reason: "규칙이 쓴 판정 근거다.",
    finalRank: "A",
    triggerCharacterIds: [],
    ...over,
  };
}

describe("엔딩 어댑터", () => {
  it("판정 근거를 화면이 다시 쓰지 않는다", () => {
    const view = createU6EndingView(CAMPAIGN, endingOf({ reason: "던전을 전부 돌파했습니다." }));

    /* 첫 줄은 규칙의 문장 그대로다. 규칙이 문턱을 바꿔도 화면이 옛말을 하지 않는다. */
    expect(view.reasons[0]).toBe("던전을 전부 돌파했습니다.");
    expect(view.reasons).toHaveLength(3);
  });

  it("등급을 규칙에서 받는다", () => {
    const view = createU6EndingView(CAMPAIGN, endingOf({ finalRank: "S" }));

    expect(view.finalRank).toBe("S");
    expect(view.report.join(" ")).toContain("최종 등급 S");
  });

  /* 던전 수와 원정 수는 다른 값이다. 한 던전을 두 번 만에 깰 수 있다. */
  it("정복한 던전 수와 원정 횟수를 섞지 않는다", () => {
    const cleared = 4;
    const campaign: CampaignState = {
      ...CAMPAIGN,
      dungeons: CAMPAIGN.dungeons.map((one, index) => index < cleared ? { ...one, status: "cleared" as const } : one),
      statistics: { ...CAMPAIGN.statistics, totalExpeditions: 9, clearedExpeditions: cleared },
    };
    const view = createU6EndingView(campaign, endingOf());

    expect(view.report.join(" ")).toContain(`던전 ${cleared}곳 정복`);
    expect(view.reasons[1]).toContain("9번의 원정에서");
  });

  /* 불신은 원정 파티가 부른 결말이다. 풀 전체를 세면 뜻이 달라진다. */
  it("불신은 원정 생존자를 센다", () => {
    const party = CAMPAIGN.pool.order.slice(0, 3);
    const view = createU6EndingView(CAMPAIGN, endingOf({ kind: "distrust", triggerCharacterIds: party }));

    expect(view.zeroTrustPartySize).toBe(3);
    expect(view.report.join(" ")).toContain("신뢰 0 인 원정 생존자 3명");
  });

  it("고발한 사람의 이름을 규칙이 준 순서로 적는다", () => {
    const five = CAMPAIGN.pool.order.slice(0, 5);
    const names = five.map((id) => CAMPAIGN.pool.byId[id]!.name).join(" · ");
    const view = createU6EndingView(CAMPAIGN, endingOf({ kind: "denounced", triggerCharacterIds: five }));

    expect(view.reasons[1]).toContain(names);
  });

  /* 이름을 못 찾아도 undefined 를 문장에 흘려보내지 않는다. */
  it("이름이 없으면 이름 없이 쓴다", () => {
    const view = createU6EndingView(CAMPAIGN, endingOf({ kind: "denounced", triggerCharacterIds: [] }));

    expect(view.reasons[1]).not.toContain("undefined");
    expect(view.reasons[1]).toBe("돌아온 이들이 길드에 같은 말을 했습니다.");
  });

  it("이력이 없으면 전환점도 없다", () => {
    expect(createU6EndingView(CAMPAIGN, endingOf()).turningPoint).toBeNull();
  });

  /* 전환점은 `C8-B` 가 고른다. 화면이 "가장 큰 사건" 을 다시 판단하지 않는다. */
  it("전환점을 규칙이 고른 대로 옮긴다", () => {
    let history = createCampaignHistory();
    history = appendCampaignEvent(history, {
      campaignTurn: 7,
      event: toTrustCollapsedEventDraft({
        expeditionId: "exp",
        ending: endingOf({ kind: "distrust", triggerCharacterIds: [CAMPAIGN.pool.order[0]!] }),
      }),
    });
    const campaign: CampaignState = {
      ...CAMPAIGN,
      history: { ...history, turningPoints: deriveTurningPoints(history.events) },
    };
    const view = createU6EndingView(campaign, endingOf());

    expect(view.turningPoint).toEqual({ label: "신뢰 붕괴", detail: "7회차" });
  });
});

describe("조언 총계", () => {
  /* 이력 전체를 세면 보스전이 조언 수에 섞인다. */
  it("조언이 아닌 이력은 세지 않는다", () => {
    let history = createCampaignHistory();
    const advice = 3;
    for (let index = 0; index < advice; index += 1) {
      history = appendCampaignEvent(history, {
        campaignTurn: 1,
        event: toAdviceResolvedEventDraft({
          expeditionId: "exp",
          dungeonId: CAMPAIGN.dungeons[0]!.id,
          sourceEventId: `event-${index}` as never,
          decision: {
            adviceId: `choice-${index}` as never,
            outcome: "help",
            /* 이력 무결성이 실행 여부와 반응의 일치를 요구한다. */
            executed: true,
            reactions: [{ characterId: CAMPAIGN.pool.order[index]!, reaction: "accepted" }],
            delayedRecords: [],
            trustChanges: [],
          } as never,
        }),
      });
    }
    history = appendCampaignEvent(history, {
      campaignTurn: 1,
      event: toBossBattleResolvedEventDraft({
        expeditionId: "exp",
        dungeonId: CAMPAIGN.dungeons[0]!.id,
        bossId: CAMPAIGN.dungeons[0]!.bossId,
        result: { status: "cleared", survivorIds: [], battle: null, applications: [], verifications: [], cues: [] } as never,
      }),
    });

    const view = createU6EndingView({ ...CAMPAIGN, history }, endingOf());

    expect(history.events).toHaveLength(advice + 1);
    expect(view.adviceTotal).toBe(advice);
  });
});
