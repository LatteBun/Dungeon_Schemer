import { describe, expect, it } from "vitest";
import { CLASSES } from "@/lib/content/classes";
import { SPIDER_BOSSES, THEMES } from "@/lib/content/themes";
import { resolveBossBattle, retryBossStats } from "@/lib/rules/boss-battle-adapter";
import type {
  CampaignDungeon,
  Character,
  CharacterId,
  ChoiceId,
  ClassId,
  EventId,
  InfoRecord,
} from "@/lib/domain";

function member(id: string, overrides: Partial<Character> = {}): Character {
  return {
    id: id as CharacterId,
    name: id,
    classId: "warrior" as ClassId,
    personality: "prudent",
    maxHp: 45,
    hp: 45,
    trust: 50,
    gold: 10,
    alive: true,
    gravelyWounded: false,
    ...overrides,
  };
}

function dungeon(overrides: Partial<CampaignDungeon> = {}): CampaignDungeon {
  return {
    id: "dungeon-spider-01" as never,
    name: "거미굴",
    theme: "spider",
    initialRiskLevel: 1,
    riskLevel: 1,
    activeRuleIds: [],
    activeMonsterIds: [],
    ecologyProfileId: "spider-calm-web" as never,
    bossId: SPIDER_BOSSES[0].id,
    status: "unexplored",
    attempts: 0,
    ...overrides,
  };
}

function info(overrides: Partial<InfoRecord> = {}): InfoRecord {
  return {
    eventId: "boss-event" as EventId,
    adviceId: "boss-advice" as ChoiceId,
    outcome: "help",
    characterId: "member-1" as CharacterId,
    reaction: "accepted",
    bossRuleId: "boss-ragna-crouch" as never,
    pendingVerification: true,
    ...overrides,
  };
}

function resolve(input: Partial<Parameters<typeof resolveBossBattle>[0]> = {}) {
  const members = input.members ?? [member("member-1")];
  return resolveBossBattle({
    dungeon: dungeon(),
    theme: THEMES[0],
    members,
    classDefs: CLASSES,
    infoRecords: [],
    seed: "boss-adapter",
    pendingMerchantEffect: null,
    ...input,
  });
}

describe("E4 보스 BattleEngine adapter", () => {
  it("보스 정보 multiplier와 merchant pending을 공통 엔진 입력으로 전달하고 소비한다", () => {
    const result = resolve({
      infoRecords: [info()],
      pendingMerchantEffect: { adviceId: "merchant-1" as ChoiceId, nextBattle: { incomingDamageMultiplier: 0.5 } },
    });
    expect(result.bossResult.battle.actions.length).toBeGreaterThan(0);
    expect(result.bossResult.applications[0]?.axis).toBe("incomingDamage");
    expect(result.pendingMerchantEffect).toBeNull();
  });

  it("현재 위험도와 초기 위험도의 차이만 보스 scaling에 반영한다", () => {
    const stats = retryBossStats(SPIDER_BOSSES[0], { initialRiskLevel: 1, riskLevel: 3 });
    expect(stats.maxHp).toBe(Math.round(SPIDER_BOSSES[0].maxHp * 1.2));
    expect(stats.baseDamage).toBe(Math.round(SPIDER_BOSSES[0].baseDamage * 1.2));
    expect(retryBossStats(SPIDER_BOSSES[0], { initialRiskLevel: 1, riskLevel: 5 })).toEqual(
      retryBossStats(SPIDER_BOSSES[0], { initialRiskLevel: 1, riskLevel: 5 }),
    );
  });

  it("accepted와 suspected는 서로 다른 사후 검증 결과를 만든다", () => {
    const result = resolve({
      infoRecords: [
        info({ adviceId: "accepted" as ChoiceId, reaction: "accepted" }),
        info({ adviceId: "suspected" as ChoiceId, reaction: "suspected" }),
      ],
    });
    expect(result.bossResult.verifications.map((verification) => verification.action).toSorted()).toEqual([
      "adviceHelped",
      "suspicionWasCostly",
    ]);
  });

  it("전투 중 사망한 인물에게 지연 신뢰 변화를 적용하지 않는다", () => {
    const target = member("member-1", { hp: 1, trust: 50 });
    const result = resolve({ members: [target], infoRecords: [info()] });
    expect(result.members[0]?.alive).toBe(false);
    expect(result.members[0]?.trust).toBe(50);
    expect(result.trustChanges).toEqual([]);
  });

  it("동일 입력은 전투·검증·cue까지 결정적이다", () => {
    const input = { infoRecords: [info()] };
    expect(resolve(input)).toEqual(resolve(input));
  });
});
