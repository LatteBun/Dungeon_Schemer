import { describe, expect, it } from "vitest";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createBoardOffers, rollContractReward } from "@/lib/rules/board";
import { canDeploy, isContractRewardInRange } from "@/lib/domain";
import type {
  CampaignState,
  Character,
  CharacterId,
  CharacterPool,
  ClassId,
  GuideRank,
} from "@/lib/domain";

function character(id: string, classId: ClassId, alive = true): Character {
  return {
    id: id as CharacterId,
    name: `테스트 ${id}`,
    classId,
    personality: "prudent",
    maxHp: 40,
    hp: 40,
    trust: alive ? 50 : 0,
    gold: 30,
    alive,
    gravelyWounded: false,
  };
}

function poolFor(classIds: readonly (ClassId | string)[]): CharacterPool {
  const byId: Record<CharacterId, Character> = {};
  const order: CharacterId[] = [];
  classIds.forEach((classId, index) => {
    const id = `fixture-${String(index + 1).padStart(3, "0")}` as CharacterId;
    byId[id] = character(id, classId as ClassId);
    order.push(id);
  });
  return { byId, order };
}

function stateWithClasses(
  classIds: readonly (ClassId | string)[],
  rank: GuideRank = "C",
): CampaignState {
  return {
    ...initializeCampaign("c2-board-fixture"),
    rank,
    pool: poolFor(classIds),
  };
}

function woundMember(state: CampaignState, index: number): CampaignState {
  const id = state.pool.order[index];
  if (id === undefined) return state;
  const member = state.pool.byId[id];
  if (member === undefined) return state;
  return {
    ...state,
    pool: {
      ...state.pool,
      byId: { ...state.pool.byId, [id]: { ...member, gravelyWounded: true } },
    },
  };
}

describe("createBoardOffers", () => {
  it("초기 C급에서 위험도 높은 네 ★2와 시드로 정한 ★1을 게시한다", () => {
    const offers = createBoardOffers(initializeCampaign("c2-board"));

    expect(offers).toHaveLength(5);
    expect(offers.map((offer) => offer.riskLevel)).toEqual([2, 2, 2, 2, 1]);
    expect(offers.every((offer) => offer.id.startsWith("offer-0-"))).toBe(true);
  });

  it("공고의 위험도는 현재 던전 콘텐츠에서 복사하고 환경 특성은 공개하지 않는다", () => {
    const state = initializeCampaign("c2-board-content");
    const offers = createBoardOffers(state);

    for (const offer of offers) {
      const dungeon = state.dungeons.find((candidate) => candidate.id === offer.dungeonId);
      expect(dungeon).toBeDefined();
      expect(offer.riskLevel).toBe(dungeon?.riskLevel);
      expect(offer).not.toHaveProperty("publicEnvironmentTag");
    }
  });

  it("같은 입력을 다시 생성해도 값은 같고 반환 참조는 공유하지 않는다", () => {
    const state = initializeCampaign("c2-board-repro");
    const first = createBoardOffers(state);
    const second = createBoardOffers(state);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second[0]).not.toBe(first[0]);
    expect(second[0]?.reward).not.toBe(first[0]?.reward);
    expect(second[0].party).not.toBe(first[0].party);
    expect(second[0].party.memberIds).not.toBe(first[0].party.memberIds);
    expect(state.offers).toEqual([]);
  });

  it("명성과 골드를 각자 범위에서 두 번의 독립 추첨한다", () => {
    const calls: Array<readonly [number, number]> = [];
    const rng = {
      int(min: number, max: number) {
        calls.push([min, max]);
        return calls.length === 1 ? max : min;
      },
    };

    expect(rollContractReward(3, rng)).toEqual({ reputation: 17, gold: 27 });
    expect(calls).toEqual([[13, 17], [27, 37]]);
  });

  it("모든 공고 보상은 범위 내이고 같은 입력에서 재현된다", () => {
    const state = initializeCampaign("offer-reward-repro");
    const first = createBoardOffers(state);
    const second = createBoardOffers(state);

    expect(second.map((offer) => offer.reward)).toEqual(first.map((offer) => offer.reward));
    for (const offer of first) {
      expect(isContractRewardInRange(offer.riskLevel, offer.reward)).toBe(true);
    }
  });

  it("잠금 공고도 고정 보상을 가진다", () => {
    const initial = initializeCampaign("offer-reward-locked");
    const state = {
      ...initial,
      dungeons: initial.dungeons.map((dungeon) => dungeon.riskLevel <= 2
        ? { ...dungeon, status: "cleared" as const }
        : dungeon),
    };
    const offers = createBoardOffers(state);

    expect(offers.every((offer) => offer.lockReason === "rankTooLow")).toBe(true);
    expect(offers.every((offer) => isContractRewardInRange(offer.riskLevel, offer.reward))).toBe(true);
  });

  it("한 게시판의 모든 공고는 서로 다른 직업 3인과 서로 다른 캐릭터를 가진다", () => {
    const state = initializeCampaign("c2-board-party");
    const offers = createBoardOffers(state);
    const memberIds = offers.flatMap((offer) => offer.party.memberIds);

    expect(memberIds).toHaveLength(offers.length * 3);
    expect(new Set(memberIds).size).toBe(memberIds.length);
    for (const offer of offers) {
      const classes = offer.party.memberIds.map((id) => state.pool.byId[id]?.classId);
      expect(new Set(classes).size).toBe(3);
    }
  });

  it("시드가 동률인 ★1 던전의 선택을 바꾼다", () => {
    const choices = new Set(
      Array.from({ length: 100 }, (_, index) =>
        createBoardOffers(initializeCampaign(`c2-board-tie-${index}`))
          .at(-1)?.dungeonId,
      ),
    );

    expect(choices.size).toBeGreaterThan(1);
  });

  it("진입 가능한 던전이 없으면 가까운 위험도의 잠금 공고부터 채운다", () => {
    const initial = initializeCampaign("c2-board-locked");
    const state: CampaignState = {
      ...initial,
      dungeons: initial.dungeons.map((dungeon) =>
        dungeon.riskLevel <= 2 ? { ...dungeon, status: "cleared" as const } : dungeon,
      ),
    };
    const offers = createBoardOffers(state);

    expect(offers).toHaveLength(5);
    expect(offers.every((offer) => offer.lockReason === "rankTooLow")).toBe(true);
    expect(offers.map((offer) => offer.riskLevel)).toEqual([3, 3, 3, 3, 4]);
  });

  it("승급으로 공고 구성이 바뀌어도 공통 던전 보상은 같다", () => {
    const state = initializeCampaign("offer-reward-promotion");
    const first = createBoardOffers(state);
    const promoted = createBoardOffers({ ...state, rank: "B" });
    let commonDungeonCount = 0;

    for (const offer of first) {
      const sameDungeon = promoted.find((candidate) => candidate.dungeonId === offer.dungeonId);
      if (sameDungeon !== undefined) {
        commonDungeonCount += 1;
        expect(sameDungeon.reward).toEqual(offer.reward);
      }
    }

    expect(commonDungeonCount).toBeGreaterThan(0);
  });

  it("다음 세계 턴의 위험도 변경은 새 위험도 범위의 보상을 만든다", () => {
    const state = initializeCampaign("offer-reward-risk-change");
    const target = state.dungeons.find((dungeon) => dungeon.riskLevel === 2)!;
    const currentState = {
      ...state,
      dungeons: state.dungeons.map((dungeon) => dungeon.id === target.id
        ? { ...dungeon, status: "unexplored" as const, riskLevel: 2 as const }
        : { ...dungeon, status: "cleared" as const }),
    };
    const currentOffer = createBoardOffers(currentState)[0]!;
    const nextState = {
      ...currentState,
      worldTurn: currentState.worldTurn + 1,
      dungeons: currentState.dungeons.map((dungeon) => dungeon.id === target.id
        ? { ...dungeon, riskLevel: 3 as const }
        : dungeon),
    };
    const nextOffer = createBoardOffers(nextState)[0]!;

    expect(isContractRewardInRange(2, currentOffer.reward)).toBe(true);
    expect(isContractRewardInRange(3, nextOffer.reward)).toBe(true);
    expect(nextOffer.reward).not.toEqual(currentOffer.reward);
  });

  it("직업 분포가 달라도 최대한 많은 완전 3인 파티만 만든다", () => {
    const state = stateWithClasses([
      "warrior",
      "warrior",
      "warrior",
      "warrior",
      "warrior",
      "rogue",
      "rogue",
      "cleric",
      "cleric",
      "mage",
      "mage",
    ]);
    const offers = createBoardOffers(state);

    expect(offers).toHaveLength(3);
    expect(offers.every((offer) => offer.party.memberIds.length === 3)).toBe(true);
  });

  it("서로 다른 직업이 세 종류 미만이면 부분 파티 대신 빈 배열을 반환한다", () => {
    const state = stateWithClasses(["warrior", "warrior", "rogue", "rogue"]);

    expect(createBoardOffers(state)).toEqual([]);
  });

  it("정상 후보가 세 직업을 만들지 못하면 중상자를 응급 후보로 사용한다", () => {
    const state = woundMember(stateWithClasses(["warrior", "rogue", "cleric"]), 2);
    const offers = createBoardOffers(state);

    expect(offers).toHaveLength(1);
    expect(offers[0]?.party.memberIds).toContain(state.pool.order[2]);
  });

  it("정상 파티가 하나라도 가능하면 중상자를 써서 공고 수를 늘리지 않는다", () => {
    const state = woundMember(stateWithClasses([
      "warrior", "rogue", "cleric", "mage", "warrior", "rogue",
    ]), 3);
    const offers = createBoardOffers(state);

    expect(offers).toHaveLength(1);
    expect(offers[0]?.party.memberIds).not.toContain(state.pool.order[3]);
  });

  it("worldTurn이 바뀌면 새 게시판 ID와 편성을 만든다", () => {
    const state = initializeCampaign("c2-board-world-turn");
    const first = createBoardOffers(state);
    const next = createBoardOffers({ ...state, worldTurn: 1 });

    expect(next.every((offer) => offer.id.startsWith("offer-1-"))).toBe(true);
    expect(next).not.toEqual(first);
  });

  it("공고 생성은 입력 상태를 변경하지 않는다", () => {
    const state = initializeCampaign("c2-board-immutable");
    const before = structuredClone(state);

    createBoardOffers(state);

    expect(state).toEqual(before);
    expect(canDeploy(state.pool.byId[state.pool.order[0]])).toBe(true);
  });
});
