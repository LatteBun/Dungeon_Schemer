import { describe, expect, it } from "vitest";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { createBoardOffers } from "@/lib/rules/board";
import { canDeploy } from "@/lib/domain";
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

describe("createBoardOffers", () => {
  it("초기 C급에서 위험도 높은 네 ★2와 시드로 정한 ★1을 게시한다", () => {
    const offers = createBoardOffers(initializeCampaign("c2-board"));

    expect(offers).toHaveLength(5);
    expect(offers.map((offer) => offer.riskLevel)).toEqual([2, 2, 2, 2, 1]);
    expect(offers.every((offer) => offer.id.startsWith("offer-0-"))).toBe(true);
  });

  it("공고의 위험도와 환경 특성은 현재 던전 콘텐츠에서 복사한다", () => {
    const state = initializeCampaign("c2-board-content");
    const offers = createBoardOffers(state);

    for (const offer of offers) {
      const dungeon = state.dungeons.find((candidate) => candidate.id === offer.dungeonId);
      expect(dungeon).toBeDefined();
      expect(offer.riskLevel).toBe(dungeon?.riskLevel);
      expect(offer.publicEnvironmentTag.id).toMatch(/-/);
      expect(offer.publicEnvironmentTag.label).not.toBe("");
    }
  });

  it("같은 입력을 다시 생성해도 값은 같고 반환 참조는 공유하지 않는다", () => {
    const state = initializeCampaign("c2-board-repro");
    const first = createBoardOffers(state);
    const second = createBoardOffers(state);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second[0]).not.toBe(first[0]);
    expect(second[0].party).not.toBe(first[0].party);
    expect(second[0].party.memberIds).not.toBe(first[0].party.memberIds);
    expect(state.offers).toEqual([]);
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
