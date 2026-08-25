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
  it("초기 C급에서 갈 수 있는 던전 다섯을 게시한다", () => {
    /*
     * 예전에는 `[2, 2, 2, 2, 1]` 을 고정으로 요구했다 — 갈 수 있는 것 중 위험도가
     * 높은 쪽부터 채우던 시절의 계약이다. 그 규칙 때문에 등급 C 의 일곱 중 ★2 넷이
     * 언제나 먼저 차고 남은 한 칸만 ★1 이 돌아가며 채웠다. 시드 예순 판에서 서로
     * 다른 조합이 세 가지뿐이라, 어느 캠페인을 시작해도 같은 게시판을 봤다.
     *
     * 이제 갈 수 있는 것 중에서는 무엇이 걸릴지 정하지 않는다. 다섯 칸이 차는
     * 것과 등급을 넘지 않는 것만 남긴다.
     */
    const offers = createBoardOffers(initializeCampaign("c2-board"));

    expect(offers).toHaveLength(5);
    for (const offer of offers) {
      expect(offer.riskLevel).toBeLessThanOrEqual(2);
      expect(offer.lockReason).toBeNull();
    }
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

/*
 * 캠페인마다 다른 게시판을 본다.
 *
 * 예전에는 갈 수 있는 것 중 위험도가 높은 쪽부터 채웠다. 등급 C 에서 갈 수 있는
 * 일곱 중 ★2 가 넷이라 그 넷이 언제나 먼저 차고, 남은 한 칸만 ★1 셋이 돌아가며
 * 채웠다 — 시드 예순 판에서 서로 다른 조합이 세 가지뿐이었다.
 */
describe("첫 게시판이 캠페인마다 다르다", () => {
  const firstBoard = (seed: string): readonly string[] => {
    const campaign = initializeCampaign(seed);
    return createBoardOffers(campaign).map((offer) => String(offer.dungeonId)).sort();
  };

  const seeds = Array.from({ length: 40 }, (_, index) => `board-variety-${index}`);

  it("같은 시드는 같은 게시판을 낸다", () => {
    expect(firstBoard("board-variety-0")).toEqual(firstBoard("board-variety-0"));
  });

  it("조합이 여러 가지로 나온다", () => {
    /* 셋뿐이던 시절을 되돌아가지 않게, 넉넉한 하한을 둔다. */
    const combinations = new Set(seeds.map((seed) => firstBoard(seed).join("|")));

    expect(combinations.size).toBeGreaterThan(8);
  });

  it("어느 던전도 매번 걸리지는 않는다", () => {
    /*
     * 예전에는 ★2 넷이 100% 로 걸렸다. 한 던전이 모든 캠페인에 나오면 그 던전은
     * 캠페인의 일부가 아니라 배경이 된다.
     */
    const counts = new Map<string, number>();
    for (const seed of seeds) {
      for (const id of firstBoard(seed)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const always = [...counts].filter(([, count]) => count === seeds.length);
    expect(always.map(([id]) => id)).toEqual([]);
  });

  it("갈 수 있는 던전만 고른다", () => {
    // 섞는 것은 차례이지 자격이 아니다. 등급을 넘는 던전이 열린 채로 걸리면 안 된다.
    const campaign = initializeCampaign("board-variety-0");
    for (const offer of createBoardOffers(campaign)) {
      if (offer.lockReason === null) expect(offer.riskLevel).toBeLessThanOrEqual(2);
    }
  });
});
