import { describe, expect, it } from "vitest";
import type { BoardDecisionView, MapDecisionView, AdviceDecisionView, PublicMemberView } from "./public-state";
import { createStrategy, partyCapacityAfterHypotheticalWipe } from "./strategies";

const member = (id: string, classId: string, overrides: Partial<PublicMemberView> = {}): PublicMemberView => ({
  id: id as PublicMemberView["id"], classId: classId as PublicMemberView["classId"], personality: "prudent",
  hp: 20, maxHp: 20, trust: 50, gold: 30, alive: true, gravelyWounded: false, ...overrides,
});

const board = (offers: BoardDecisionView["offers"], overrides: Partial<BoardDecisionView> = {}): BoardDecisionView => ({
  rank: "C", reputation: 30, gold: 100, cumulativeGold: 100, remainingDungeonCount: 5,
  offers, pool: [], promotion: null, ...overrides,
});

const offer = (id: string, riskLevel: 1 | 2 | 3 | 4 | 5, party: readonly PublicMemberView[], reputation: number, gold: number) => ({
  id: id as BoardDecisionView["offers"][number]["id"], dungeonId: `dungeon-${id}` as BoardDecisionView["offers"][number]["dungeonId"],
  dungeonName: id, theme: "spider" as const, riskLevel, fullSurvivorReward: { reputation, gold }, lockReason: null, party,
});

describe("백테스트 전략", () => {
  const cToBPromotion: NonNullable<BoardDecisionView["promotion"]> = {
    fromRank: "C", toRank: "B", newlyUnlockedRiskLevel: 3,
    reputationRequired: 60, goldRequired: 150, currentReputation: 30, currentGold: 100,
    canPromoteByReputation: false, canPromoteByGold: false,
  };

  it("생존형은 저위험·건강·신뢰 순으로 공고를 고른다", () => {
    const chosen = createStrategy("survival").chooseOffer(board([
      offer("safe-healthy", 1, [member("a", "warrior")], 3, 3),
      offer("risky", 2, [member("b", "warrior", { hp: 2 })], 10, 20),
    ]));
    expect(chosen).toEqual({ offerId: "safe-healthy", betrayal: false });
  });

  it("생존형은 등급 잠금이 보이면 접근 가능한 최고 위험도를 먼저 고른다", () => {
    const locked = { ...offer("locked", 3, [member("locked-member", "mage")], 15, 32), lockReason: "rankTooLow" as const };
    const chosen = createStrategy("survival").chooseOffer(board([
      offer("safe", 1, [member("safe-member", "warrior")], 6, 12),
      offer("frontier", 2, [member("frontier-member", "rogue")], 10, 20),
      locked,
    ], { promotion: cToBPromotion }));

    expect(chosen).toEqual({ offerId: "frontier", betrayal: false });
  });

  it("진행 잠금 중 같은 위험도에서는 보상보다 최소 HP와 신뢰를 우선한다", () => {
    const locked = { ...offer("locked", 3, [member("locked-member", "mage")], 15, 32), lockReason: "rankTooLow" as const };
    const chosen = createStrategy("survival").chooseOffer(board([
      offer("rich-hurt", 2, [member("a", "warrior", { hp: 8, maxHp: 20, trust: 90 })], 99, 99),
      offer("healthy-low-trust", 2, [member("b", "rogue", { trust: 20 })], 10, 20),
      offer("healthy-trusted", 2, [member("c", "mage", { trust: 70 })], 10, 20),
      locked,
    ], { promotion: cToBPromotion }));

    expect(chosen).toEqual({ offerId: "healthy-trusted", betrayal: false });
  });

  it("새 승급 위험도보다 낮은 인위적 잠금은 진행 잠금으로 취급하지 않는다", () => {
    const irrelevantLocked = { ...offer("irrelevant-locked", 2, [member("c", "rogue")], 10, 20), lockReason: "rankTooLow" as const };
    const view = board([
      offer("safe", 1, [member("a", "warrior")], 6, 12),
      offer("higher", 2, [member("b", "mage")], 10, 20),
      irrelevantLocked,
    ], { promotion: cToBPromotion });
    const policy = createStrategy("survival");

    expect(policy.chooseOffer(view)).toEqual({ offerId: "safe", betrayal: false });
    expect(policy.chooseOffer(view)).toEqual(policy.chooseOffer(view));
  });

  it("S등급 생존형은 기존처럼 최저 위험도를 고른다", () => {
    const chosen = createStrategy("survival").chooseOffer(board([
      offer("safe", 1, [member("a", "warrior")], 6, 12),
      offer("dangerous", 5, [member("b", "mage")], 28, 60),
    ], { rank: "S", promotion: null }));

    expect(chosen).toEqual({ offerId: "safe", betrayal: false });
  });

  it("생존형은 명성 승급 가능 시 기존처럼 승급을 공고 선택보다 우선한다", () => {
    const view = board([
      offer("accessible", 2, [member("a", "warrior")], 10, 20),
    ], {
      reputation: 60,
      promotion: { ...cToBPromotion, currentReputation: 60, canPromoteByReputation: true },
    });

    expect(createStrategy("survival").choosePromotion(view)).toBe("reputation");
  });

  it("선별적 배신형은 후보가 없으면 교정된 생존형 공고 정책으로 복귀한다", () => {
    const safe = offer("safe", 1, [member("safe-party", "warrior")], 6, 12);
    const frontier = offer("frontier", 2, [member("frontier-party", "mage")], 10, 20);
    const locked = { ...offer("locked", 3, [member("locked-party", "rogue")], 15, 32), lockReason: "rankTooLow" as const };
    const chosen = createStrategy("selective-betrayal").chooseOffer({
      ...board([safe, frontier, locked], { promotion: cToBPromotion }),
      pool: [member("only-warrior", "warrior")],
    });

    expect(chosen).toEqual({ offerId: "frontier", betrayal: false });
  });

  it("기회주의형은 고위험·명성·골드 순으로 공고를 고른다", () => {
    const chosen = createStrategy("opportunist").chooseOffer(board([
      offer("rich-risky", 2, [member("a", "warrior")], 10, 20),
      offer("safe", 1, [member("b", "warrior")], 3, 3),
    ]));
    expect(chosen).toEqual({ offerId: "rich-risky", betrayal: false });
  });

  it("진행 불능 rank 잠금은 상인 예비금보다 골드 승급을 우선한다", () => {
    // Break caught: applying the merchant reserve to a board with no accessible offers returns null and leaves the campaign unable to choose a contract.
    const lockedOffer = (id: string) => ({
      id: id as BoardDecisionView["offers"][number]["id"],
      dungeonId: `dungeon-${id}` as BoardDecisionView["offers"][number]["dungeonId"],
      dungeonName: id,
      theme: "spider" as const,
      riskLevel: 3 as const,
      fullSurvivorReward: { reputation: 20, gold: 60 },
      lockReason: "rankTooLow" as const,
      party: [member(`${id}-member`, "warrior")],
    });
    const view: BoardDecisionView = {
      rank: "C", reputation: 53, gold: 151, cumulativeGold: 151, remainingDungeonCount: 5,
      offers: [lockedOffer("one"), lockedOffer("two"), lockedOffer("three"), lockedOffer("four"), lockedOffer("five")],
      pool: [],
      promotion: {
        fromRank: "C", toRank: "B", newlyUnlockedRiskLevel: 3,
        reputationRequired: 80, goldRequired: 150, currentReputation: 53, currentGold: 151,
        canPromoteByReputation: false, canPromoteByGold: true,
      },
    };

    expect(createStrategy("opportunist").choosePromotion(view)).toBe("gold");
  });

  it("접근 가능한 공고가 있으면 기회주의형은 골드 승급 뒤 상인 예비금을 지킨다", () => {
    // Break caught: bypassing the merchant reserve whenever rank-locked offers exist spends protected merchant gold despite an available contract.
    const view: BoardDecisionView = {
      rank: "C", reputation: 53, gold: 151, cumulativeGold: 151, remainingDungeonCount: 5,
      offers: [
        {
          id: "accessible" as BoardDecisionView["offers"][number]["id"],
          dungeonId: "dungeon-accessible" as BoardDecisionView["offers"][number]["dungeonId"],
          dungeonName: "accessible", theme: "spider", riskLevel: 1,
          fullSurvivorReward: { reputation: 10, gold: 20 }, lockReason: null,
          party: [member("accessible-member", "warrior")],
        },
        {
          id: "locked" as BoardDecisionView["offers"][number]["id"],
          dungeonId: "dungeon-locked" as BoardDecisionView["offers"][number]["dungeonId"],
          dungeonName: "locked", theme: "spider", riskLevel: 3,
          fullSurvivorReward: { reputation: 20, gold: 60 }, lockReason: "rankTooLow",
          party: [member("locked-member", "mage")],
        },
      ],
      pool: [],
      promotion: {
        fromRank: "C", toRank: "B", newlyUnlockedRiskLevel: 3,
        reputationRequired: 80, goldRequired: 150, currentReputation: 53, currentGold: 151,
        canPromoteByReputation: false, canPromoteByGold: true,
      },
    };

    expect(createStrategy("opportunist").choosePromotion(view)).toBeNull();
  });

  it("경로는 전략별 category 우선순위를 따른다", () => {
    const view: MapDecisionView = {
      expeditionId: "exp", betrayed: false, currentNodeId: "entry" as MapDecisionView["currentNodeId"],
      nextNodes: [
        { id: "monster" as MapDecisionView["currentNodeId"], category: "monster" },
        { id: "rest" as MapDecisionView["currentNodeId"], category: "rest" },
        { id: "special" as MapDecisionView["currentNodeId"], category: "special" },
      ], visitedNodeIds: [], bossNodeId: "boss" as MapDecisionView["currentNodeId"], party: [], campaignGold: 0,
      hasPendingMerchantEffect: false, disclosedRuleIds: [], observations: [],
    };
    expect(createStrategy("survival").chooseNode(view)).toBe("rest");
    expect(createStrategy("opportunist").chooseNode(view)).toBe("special");
  });

  it("배신은 capacity와 중앙값 골드 조건을 모두 만족할 때만 잠근다", () => {
    const pool = [
      member("a", "warrior"), member("b", "mage"), member("c", "rogue"),
      member("d", "warrior"), member("e", "mage"), member("f", "rogue"),
      member("g", "warrior"), member("h", "mage"), member("i", "rogue"),
    ];
    expect(partyCapacityAfterHypotheticalWipe(pool, pool.slice(0, 3).map((one) => one.id))).toEqual({ normal: 2, emergency: 2 });
    const chosen = createStrategy("selective-betrayal").chooseOffer({
      ...board([
        offer("high", 2, pool.slice(0, 3), 8, 90),
        offer("low", 1, pool.slice(3, 6), 4, 30),
      ]),
      pool,
    });
    expect(chosen).toEqual({ offerId: "high", betrayal: true });
  });

  it("배신 모드에서만 harm을 의도한다", () => {
    const view = { category: "monster" as const, title: "", description: "", options: [], party: [], campaignGold: 0, hasPendingMerchantEffect: false, disclosedRuleIds: [], observations: [], expeditionId: "exp", betrayed: true } satisfies AdviceDecisionView;
    expect(createStrategy("selective-betrayal").chooseAdviceIntent(view)).toBe("harm");
    expect(createStrategy("selective-betrayal").chooseAdviceIntent({ ...view, betrayed: false })).toBe("help");
  });

  it("capacity는 같은 사람을 중복 사용하지 않는다", () => {
    const result = partyCapacityAfterHypotheticalWipe([
      member("a", "warrior"), member("b", "mage"), member("c", "rogue"), member("d", "warrior"),
    ], ["a" as PublicMemberView["id"]]);
    expect(result).toEqual({ normal: 1, emergency: 1 });
  });
});
