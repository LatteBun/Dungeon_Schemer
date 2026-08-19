import { describe, expect, it } from "vitest";
import {
  ACTIVE_ECOLOGY_RULES,
  BOARD_OFFER_MAX,
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
} from "@/lib/domain";
import type { Character, CharacterId, ClassId } from "@/lib/domain";

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
});
