import { describe, expect, it } from "vitest";
import {
  ACTIVE_ECOLOGY_RULES,
  BOARD_OFFER_MAX,
  CAMPAIGN_DUNGEON_ORDERS,
  CAMPAIGN_DUNGEON_COUNT,
  CHARACTER_POOL_SIZE,
  CHARACTERS_PER_CLASS,
  CHARACTERS_PER_PERSONALITY,
  DENOUNCE_THRESHOLD,
  ECOLOGY_RULES_PER_THEME,
  ENDING_ORDER,
  EXPEDITION_PARTY_SIZE,
  GOLD_START,
  GUIDE_RANKS,
  PERSONALITIES,
  PROMOTION_GOLD,
  PROMOTION_REPUTATION,
  RANK_RISK_LIMIT,
  REPUTATION_MIN,
  REPUTATION_START,
  RISK_LEVELS,
  SEED_STREAMS,
  THEME_IDS,
  canDeploy,
  canDeployEmergency,
  CONTRACT_REWARD_RANGES,
  contractRewardForSurvivors,
  isContractRewardInRange,
  createCampaignTransitionContext,
  createCampaignStatistics,
} from "@/lib/domain";
import type {
  BoardOffer,
  Character,
  CharacterId,
  ClassId,
  DungeonId,
  DungeonLayer,
  GeneratedMap,
  NodeId,
  OfferId,
  EncounterDefinition,
  EncounterModifier,
  ImmediateEventEffect,
  MonsterId,
  CampaignTransition,
} from "@/lib/domain";

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: "character-001" as CharacterId,
    name: "테스트",
    classId: "warrior" as ClassId,
    personality: "prudent",
    maxHp: 100,
    hp: 100,
    trust: 50,
    gold: 30,
    alive: true,
    gravelyWounded: false,
    ...overrides,
  };
}

describe("도메인 상수", () => {
  it("캠페인 던전 순서와 빈 통계 계약을 공개한다", () => {
    expect(CAMPAIGN_DUNGEON_ORDERS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(createCampaignStatistics()).toEqual({
      settlements: [],
      settlementHistory: [],
      totalExpeditions: 0,
      clearedExpeditions: 0,
      wipedExpeditions: 0,
      totalDeaths: 0,
      totalGoldEarned: 0,
      highestDungeonCleared: 0,
    });
  });

  it("새 캠페인 전이 컨텍스트는 선택 공고와 활성 원정이 없다", () => {
    expect(createCampaignTransitionContext()).toEqual({
      selectedOffer: null,
      activeExpedition: null,
    });
  });

  it("캠페인 전이는 판별 가능한 action union을 공개한다", () => {
    const actions: CampaignTransition[] = [
      { type: "OPEN_BOARD" },
      { type: "SELECT_CONTRACT", offerId: "offer-1" as OfferId },
      { type: "PROMOTE_GUIDE", method: "gold" },
    ];
    expect(actions.map((action) => action.type)).toEqual([
      "OPEN_BOARD", "SELECT_CONTRACT", "PROMOTE_GUIDE",
    ]);
  });

  it("풀 30명이 5직업·5성격으로 균등하게 나뉜다", () => {
    expect(CHARACTER_POOL_SIZE).toBe(30);
    expect(PERSONALITIES.length * CHARACTERS_PER_PERSONALITY).toBe(CHARACTER_POOL_SIZE);
    // 직업은 열린 목록이라 개수를 상수로 확인할 수 없다. 몫만 고정한다.
    expect(CHARACTER_POOL_SIZE % CHARACTERS_PER_CLASS).toBe(0);
  });

  it("위험도는 다섯 단계이고 테마는 셋이다", () => {
    expect(RISK_LEVELS).toEqual([1, 2, 3, 4, 5]);
    expect(THEME_IDS).toHaveLength(3);
  });

  it("활성 규칙은 테마 규칙보다 적다", () => {
    expect(ACTIVE_ECOLOGY_RULES).toBeLessThan(ECOLOGY_RULES_PER_THEME);
  });

  it("엔딩 다섯의 판정 순서가 고정돼 있다", () => {
    expect(ENDING_ORDER).toEqual([
      "distrust",
      "denounced",
      "completed",
      "exhausted",
      "unemployed",
    ]);
  });

  it("시드 스트림에 생태와 월드턴이 있다", () => {
    expect(SEED_STREAMS).toContain("ecology");
    expect(SEED_STREAMS).toContain("worldturn");
    expect(new Set(SEED_STREAMS).size).toBe(SEED_STREAMS.length);
  });

  it("캠페인 시작값과 게시판 크기가 문서와 같다", () => {
    expect(REPUTATION_START).toBe(30);
    expect(REPUTATION_MIN).toBe(0);
    expect(GOLD_START).toBe(10);
    expect(CAMPAIGN_DUNGEON_COUNT).toBe(15);
    expect(BOARD_OFFER_MAX).toBe(5);
    expect(EXPEDITION_PARTY_SIZE).toBe(3);
    expect(DENOUNCE_THRESHOLD).toBe(5);
  });

  it("진입 한계가 등급마다 오르고 S에서 최대 위험도에 닿는다", () => {
    const limits = GUIDE_RANKS.map((rank) => RANK_RISK_LIMIT[rank]);
    expect(limits).toEqual([2, 3, 4, 5]);
  });

  it("승급 요구치가 등급이 오를수록 커진다", () => {
    expect(PROMOTION_REPUTATION.B).toBeLessThan(PROMOTION_REPUTATION.A);
    expect(PROMOTION_REPUTATION.A).toBeLessThan(PROMOTION_REPUTATION.S);
    expect(PROMOTION_GOLD.B).toBeLessThan(PROMOTION_GOLD.A);
    expect(PROMOTION_GOLD.A).toBeLessThan(PROMOTION_GOLD.S);
  });
});

describe("출전 가능 판정", () => {
  it("생존·신뢰 0 초과·중상 아님을 모두 만족해야 한다", () => {
    expect(canDeploy(character())).toBe(true);
    expect(canDeploy(character({ alive: false }))).toBe(false);
    expect(canDeploy(character({ trust: 0 }))).toBe(false);
    expect(canDeploy(character({ gravelyWounded: true }))).toBe(false);
  });

  it("신뢰 1은 출전할 수 있다", () => {
    // 신뢰 0만 후보에서 빠진다. 낮은 신뢰는 위험할 뿐 자격이 아니다.
    expect(canDeploy(character({ trust: 1 }))).toBe(true);
  });

  it("응급 후보는 중상을 포함하지만 사망자와 신뢰 0은 제외한다", () => {
    expect(canDeployEmergency(character({ gravelyWounded: true }))).toBe(true);
    expect(canDeployEmergency(character({ alive: false }))).toBe(false);
    expect(canDeployEmergency(character({ trust: 0 }))).toBe(false);
  });
});

describe("공개 환경 특성 계약", () => {
  it("공고가 공개 환경 특성을 보관하지 않는다", () => {
    const offer = {
      id: "offer-0-dungeon-spider-01" as OfferId,
      dungeonId: "dungeon-spider-01" as DungeonId,
      riskLevel: 1,
      reward: { reputation: 6, gold: 12 },
      party: { memberIds: [] },
      lockReason: null,
    } satisfies BoardOffer;

    expect("publicEnvironmentTag" in offer).toBe(false);
  });
});

describe("던전 지도 레이어 계약", () => {
  it("GeneratedMap이 일반 Depth 레이어를 순서대로 표현한다", () => {
    const layers: readonly DungeonLayer[] = [
      { depth: 1, nodeIds: ["dungeon-001-attempt-0-depth-1-node-0" as NodeId] },
    ];
    const map: GeneratedMap = {
      entryNodeId: "dungeon-001-attempt-0-entry" as NodeId,
      bossNodeId: "dungeon-001-attempt-0-boss" as NodeId,
      layers,
      nodes: [],
    };

    expect(map.layers).toBe(layers);
    expect(map.layers[0]?.depth).toBe(1);
  });
});

describe("E3 사건 계약", () => {
  it("monster 사건은 encounter와 수정 계약을 표현할 수 있다", () => {
    const event = {
      id: "monster-1",
      kind: "monster",
      theme: "spider",
      title: "거미",
      description: "거미가 길을 막는다.",
      advice: [],
      defaultResultText: "전투를 피한다.",
      encounter: {
        enemies: [{ monsterId: "spider-cave" as MonsterId, count: 2 }],
      } satisfies EncounterDefinition,
      encounterModifier: {
        removeEnemies: [{ monsterId: "spider-cave" as MonsterId, count: 1 }],
        addEnemies: [{ monsterId: "spider-shadow" as MonsterId, count: 1 }],
      } satisfies EncounterModifier,
    };

    expect(event.encounter.enemies[0]?.count).toBe(2);
    expect(event.encounterModifier.addEnemies?.[0]?.monsterId).toBe("spider-shadow");
  });

  it("rest/special 기본 결과와 조언은 concrete 즉시 효과를 가질 수 있다", () => {
    const effect = { kind: "hp", hpDeltaPerMember: 4 } satisfies ImmediateEventEffect;
    expect(effect).toEqual({ kind: "hp", hpDeltaPerMember: 4 });
  });

  it("risk reward ranges have midpoint values matching the existing balance", () => {
    const expected = [
      [1, 6, 12], [2, 10, 20], [3, 15, 32], [4, 21, 45], [5, 28, 60],
    ] as const;
    for (const [risk, reputation, gold] of expected) {
      const range = CONTRACT_REWARD_RANGES[risk];
      expect((range.reputation.min + range.reputation.max) / 2).toBe(reputation);
      expect((range.gold.min + range.gold.max) / 2).toBe(gold);
    }
  });

  it("scales a full contract reward by survivor count at 100, 60, and 30 percent", () => {
    const full = { reputation: 16, gold: 35 };
    expect(contractRewardForSurvivors(full, 3)).toEqual({ reputation: 16, gold: 35 });
    expect(contractRewardForSurvivors(full, 2)).toEqual({ reputation: 9, gold: 21 });
    expect(contractRewardForSurvivors(full, 1)).toEqual({ reputation: 4, gold: 10 });
    expect(contractRewardForSurvivors(full, 0)).toEqual({ reputation: 0, gold: 0 });
  });

  it("accepts only integer rewards inside the selected risk range", () => {
    expect(isContractRewardInRange(3, { reputation: 13, gold: 37 })).toBe(true);
    expect(isContractRewardInRange(3, { reputation: 12, gold: 37 })).toBe(false);
    expect(isContractRewardInRange(3, { reputation: 13.5, gold: 32 })).toBe(false);
  });
});
