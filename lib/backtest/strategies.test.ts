import { describe, expect, it } from "vitest";
import type { BoardDecisionView, MapDecisionView, AdviceDecisionView, PublicMemberView } from "./public-state";
import { createStrategy, partyCapacityAfterHypotheticalWipe } from "./strategies";

const member = (id: string, classId: string, overrides: Partial<PublicMemberView> = {}): PublicMemberView => ({
  id: id as PublicMemberView["id"], classId: classId as PublicMemberView["classId"], personality: "prudent",
  hp: 20, maxHp: 20, trust: 50, gold: 30, alive: true, gravelyWounded: false, ...overrides,
});

const board = (offers: BoardDecisionView["offers"]): BoardDecisionView => ({
  rank: "C", reputation: 30, gold: 100, cumulativeGold: 100, remainingDungeonCount: 5,
  offers, pool: [], promotion: null,
});

const offer = (id: string, riskLevel: 1 | 2 | 3 | 4 | 5, party: readonly PublicMemberView[], reputation: number, gold: number) => ({
  id: id as BoardDecisionView["offers"][number]["id"], dungeonId: `dungeon-${id}` as BoardDecisionView["offers"][number]["dungeonId"],
  dungeonName: id, theme: "spider" as const, riskLevel, fullSurvivorReward: { reputation, gold }, lockReason: null, party,
});

describe("백테스트 전략", () => {
  it("생존형은 저위험·건강·신뢰 순으로 공고를 고른다", () => {
    const chosen = createStrategy("survival").chooseOffer(board([
      offer("safe-healthy", 1, [member("a", "warrior")], 3, 3),
      offer("risky", 2, [member("b", "warrior", { hp: 2 })], 10, 20),
    ]));
    expect(chosen).toEqual({ offerId: "safe-healthy", betrayal: false });
  });

  it("기회주의형은 고위험·명성·골드 순으로 공고를 고른다", () => {
    const chosen = createStrategy("opportunist").chooseOffer(board([
      offer("rich-risky", 2, [member("a", "warrior")], 10, 20),
      offer("safe", 1, [member("b", "warrior")], 3, 3),
    ]));
    expect(chosen).toEqual({ offerId: "rich-risky", betrayal: false });
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
