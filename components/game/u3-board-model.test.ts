import { describe, expect, it } from "vitest";
import type { CharacterId } from "@/lib/domain";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createBoardOffers } from "@/lib/rules/board";
import {
  contractOutcomesForReward,
  createU3BoardView,
} from "./u3-board-model";

describe("U3 board model", () => {
  it("확정 보상으로 생존 인원별 계약 결과를 계산한다", () => {
    expect(contractOutcomesForReward({ reputation: 16, gold: 35 })).toEqual([
      { survivors: 3, label: "전원 생존 시", reputation: 16, gold: 35, reputationLoss: 0 },
      { survivors: 2, label: "2명 생존 시", reputation: 9, gold: 21, reputationLoss: 0 },
      { survivors: 1, label: "1명 생존 시", reputation: 4, gold: 10, reputationLoss: 0 },
      { survivors: 0, label: "전원 사망 시", reputation: 0, gold: 0, reputationLoss: 16 },
    ]);
  });

  it("게시판 카드와 상세가 공고의 확정 보상을 그대로 쓴다", () => {
    const campaign = initializeCampaign("u3-confirmed-reward");
    const source = createBoardOffers(campaign)[0]!;
    const offer = { ...source, reward: { reputation: 11, gold: 23 } };
    const board = createU3BoardView(campaign, [offer]);

    expect(board.notices[0]).toMatchObject({ reputationReward: 11, goldReward: 23 });
    expect(board.detailsByOfferId[offer.id]?.contractOutcomes[0]).toMatchObject({ reputation: 11, gold: 23 });
  });

  it("C2 공고 모델은 공개 환경 특성을 투영하지 않는다", () => {
    const campaign = initializeCampaign("u3-board-model-environment");
    const offers = createBoardOffers(campaign);
    const board = createU3BoardView(campaign, offers);

    expect(board.notices.length).toBeGreaterThan(0);
    expect(board.notices.length).toBeLessThanOrEqual(5);
    expect(board.notices).toHaveLength(offers.length);

    expect(board.notices.every((notice) => !("environmentLabel" in notice))).toBe(true);
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

    /* 앉는 자리는 섞이므로 자리가 아니라 사람으로 찾는다. */
    const member = firstDetail?.party.find((one) => String(one.id) === String(firstMemberId));
    expect(member?.portraitSrc).toBe(portraitSrc);
  });
});

/*
 * 게시판에 걸리는 차례는 섞인다.
 *
 * `C1` 은 접근 가능한 것 중 위험도 높은 쪽부터 고른다. 그 차례가 그대로 벽에
 * 걸리면 첫 자리가 언제나 가장 위험한 던전이라, 길잡이가 공고를 읽지 않고 자리만
 * 보고 고르게 된다.
 */
describe("U3 게시판 차례", () => {
  const boardFor = (seed: string) => {
    const campaign = initializeCampaign(seed);
    const offers = createBoardOffers(campaign);
    return { campaign, offers };
  };
  const order = (seed: string) => {
    const { campaign, offers } = boardFor(seed);
    return createU3BoardView(campaign, offers).notices.map((one) => String(one.offerId));
  };

  it("같은 시드는 같은 차례를 낸다", () => {
    // 렌더마다 다시 섞이면 누르려던 공고가 손 밑에서 움직인다.
    expect(order("board-order-1")).toEqual(order("board-order-1"));
  });

  it("규칙이 고른 공고를 그대로 다 건다", () => {
    const { campaign, offers } = boardFor("board-order-1");
    const shown = offers.slice(0, 5).map((one) => String(one.id));
    const rendered = createU3BoardView(campaign, offers).notices.map((one) => String(one.offerId));

    expect([...rendered].sort()).toEqual([...shown].sort());
    expect(rendered).toHaveLength(shown.length);
  });

  it("규칙이 준 차례를 그대로 쓰지 않는다", () => {
    /*
     * 한 시드가 우연히 제자리로 섞일 수 있으므로 여러 시드를 본다.
     * 규칙 순서와 다른 시드가 하나도 없으면 섞지 않는 것이다.
     */
    const seeds = Array.from({ length: 12 }, (_, index) => `board-order-scan-${index}`);
    const changed = seeds.filter((seed) => {
      const { campaign, offers } = boardFor(seed);
      const ruleOrder = offers.slice(0, 5).map((one) => String(one.id));
      const shown = createU3BoardView(campaign, offers).notices.map((one) => String(one.offerId));
      return ruleOrder.join("|") !== shown.join("|");
    });

    expect(changed.length).toBeGreaterThan(0);
  });

  it("위험도가 언제나 내림차순으로 걸리지는 않는다", () => {
    // 자리만 보고 고를 수 없어야 한다는 것이 이 변경의 목적이다.
    const seeds = Array.from({ length: 12 }, (_, index) => `board-order-risk-${index}`);
    const descending = seeds.filter((seed) => {
      const { campaign, offers } = boardFor(seed);
      const risks = createU3BoardView(campaign, offers).notices.map((one) => one.riskLevel);
      return risks.every((risk, index) => index === 0 || risks[index - 1]! >= risk);
    });

    expect(descending.length).toBeLessThan(seeds.length);
  });
});
