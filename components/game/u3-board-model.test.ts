import { describe, expect, it } from "vitest";
import type { CharacterId } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createBoardOffers } from "@/lib/rules/board";
import {
  contractOutcomesForRisk,
  createU3BoardView,
} from "./u3-board-model";

describe("U3 board model", () => {
  it("위험도 3의 생존 인원별 계약 결과를 공식 보상표로 계산한다", () => {
    expect(contractOutcomesForRisk(3)).toEqual([
      {
        survivors: 3,
        label: "전원 생존 시",
        reputation: 15,
        gold: 32,
        reputationLoss: 0,
      },
      {
        survivors: 2,
        label: "2명 생존 시",
        reputation: 9,
        gold: 19,
        reputationLoss: 0,
      },
      {
        survivors: 1,
        label: "1명 생존 시",
        reputation: 4,
        gold: 9,
        reputationLoss: 0,
      },
      {
        survivors: 0,
        label: "전원 사망 시",
        reputation: 0,
        gold: 0,
        reputationLoss: 15,
      },
    ]);
  });

  it("C2 공고의 공개 환경 특성을 공고마다 정확히 하나씩 투영한다", () => {
    const campaign = initializeCampaign("u3-board-model-environment");
    const offers = createBoardOffers(campaign);
    const board = createU3BoardView(campaign, offers);

    expect(board.notices.length).toBeGreaterThan(0);
    expect(board.notices.length).toBeLessThanOrEqual(5);
    expect(board.notices).toHaveLength(offers.length);

    for (const [index, offer] of offers.entries()) {
      expect(board.notices[index]?.environmentLabel).toBe(
        offer.publicEnvironmentTag.label,
      );
    }
  });

  it("공고의 임시 파티 3명을 캠페인의 실제 캐릭터 상태로 해석한다", () => {
    const campaign = initializeCampaign("u3-board-model-party");
    const offers = createBoardOffers(campaign);
    const board = createU3BoardView(campaign, offers);
    const first = offers[0];

    expect(first).toBeDefined();
    if (first === undefined) return;

    const detail = board.detailsByOfferId[first.id];
    expect(detail).toBeDefined();
    expect(detail?.party).toHaveLength(3);

    for (const member of detail?.party ?? []) {
      const memberId: CharacterId = member.id;
      const source = campaign.pool.byId[memberId];
      expect(source).toBeDefined();
      expect(member.hp).toBe(source?.hp);
      expect(member.maxHp).toBe(source?.maxHp);
      expect(member.trust).toBe(source?.trust);
      expect(member.gold).toBe(source?.gold);
    }
  });

  it("캐릭터 초상 매핑이 있으면 파티 화면 모델에 경로를 전달한다", () => {
    const campaign = initializeCampaign("u3-board-model-portrait");
    const offers = createBoardOffers(campaign);
    const firstMemberId = offers[0]?.party.memberIds[0];

    expect(firstMemberId).toBeDefined();
    if (firstMemberId === undefined) return;

    const portraitSrc = `/assets/characters/${firstMemberId}.webp`;
    const board = createU3BoardView(campaign, offers, {
      [firstMemberId]: portraitSrc,
    });
    const firstDetail = offers[0] === undefined
      ? undefined
      : board.detailsByOfferId[offers[0].id];

    expect(firstDetail?.party[0]?.portraitSrc).toBe(portraitSrc);
  });
});
