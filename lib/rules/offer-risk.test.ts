import { describe, expect, it } from "vitest";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
import { EVENT_KINDS } from "@/lib/domain";
import type { BoardOffer, CampaignState, DungeonId } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { previewOfferMap, summarizeOfferRisk } from "./offer-risk";

/** 잠기지 않은 첫 공고. board[0]은 명성 제한으로 잠겨 있을 수 있다. */
function openOffer(state: CampaignState): BoardOffer {
  const offer = state.board.find((candidate) => !candidate.locked);
  if (offer === undefined) throw new Error("잠기지 않은 공고가 없다.");
  return offer;
}

describe("previewOfferMap", () => {
  it("캠페인에 없는 던전이면 오류를 낸다", () => {
    const state = initializeCampaign("c5-없는던전");
    const offer: BoardOffer = {
      ...openOffer(state),
      dungeonId: "dungeon-없음" as DungeonId,
    };
    expect(() => previewOfferMap(state, offer, DUNGEON_EVENT_POOLS)).toThrow(
      /캠페인에 없는 던전/,
    );
  });

  it("실패 횟수가 오르면 다른 지도를 만든다", () => {
    const state = initializeCampaign("c5-실패");
    const offer = openOffer(state);
    const retried: CampaignState = {
      ...state,
      dungeons: state.dungeons.map((dungeon) =>
        dungeon.id === offer.dungeonId
          ? { ...dungeon, failureCount: 1 }
          : dungeon,
      ),
    };

    expect(previewOfferMap(retried, offer, DUNGEON_EVENT_POOLS)).not.toEqual(
      previewOfferMap(state, offer, DUNGEON_EVENT_POOLS),
    );
  });
});

describe("summarizeOfferRisk", () => {
  it("개수 합과 보스가 공고의 지점 수와 맞는다", () => {
    const state = initializeCampaign("c5-합계");
    const offer = openOffer(state);
    const risk = summarizeOfferRisk(state, offer, DUNGEON_EVENT_POOLS);

    const total = EVENT_KINDS.reduce((sum, kind) => sum + risk.counts[kind], 0);
    expect(total).toBe(offer.nodeCount);
    expect(risk.bossCount).toBe(1);
  });

  it("네 분류가 모두 한 번 이상 나온다", () => {
    const state = initializeCampaign("c5-분류");
    const risk = summarizeOfferRisk(state, openOffer(state), DUNGEON_EVENT_POOLS);
    for (const kind of EVENT_KINDS) {
      expect(risk.counts[kind]).toBeGreaterThan(0);
    }
  });

  it("같은 입력은 같은 요약을 낸다", () => {
    const state = initializeCampaign("c5-재현");
    const offer = openOffer(state);
    expect(summarizeOfferRisk(state, offer, DUNGEON_EVENT_POOLS)).toEqual(
      summarizeOfferRisk(state, offer, DUNGEON_EVENT_POOLS),
    );
  });
});
