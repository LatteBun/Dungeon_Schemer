import { describe, expect, it } from "vitest";
import { CLASSES } from "@/lib/content/classes";
import { SPIDER_BOSSES, THEMES } from "@/lib/content/themes";
import { RuleError } from "@/lib/domain";
import { balancedBossStats, resolveBossBattle } from "@/lib/rules/boss-battle-adapter";
import type {
  CampaignDungeon,
  BossRuleId,
  Character,
  CharacterId,
  ChoiceId,
  ClassDef,
  ClassId,
  EventId,
  InfoRecord,
  ThemeContent,
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
    campaignOrder: 1,
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

function classesWithWarriorAttack(attack: number): readonly ClassDef[] {
  return CLASSES.map((classDef) => classDef.id === "warrior" ? { ...classDef, attack } : classDef);
}

function themeWithBossStats(stats: { readonly maxHp: number; readonly baseDamage: number }): ThemeContent {
  return {
    ...THEMES[0],
    bosses: THEMES[0].bosses.map((boss) => boss.id === SPIDER_BOSSES[0].id ? { ...boss, ...stats } : boss),
  };
}

function expectRuleError(run: () => unknown, expected: { code: string; details: Record<string, unknown> }): void {
  try {
    run();
    throw new Error("RuleError가 발생하지 않았다");
  } catch (error) {
    expect(error).toBeInstanceOf(RuleError);
    expect((error as RuleError).code).toBe(expected.code);
    expect((error as RuleError).details).toMatchObject(expected.details);
  }
}

function firstPartyAction(result: ReturnType<typeof resolveBossBattle>) {
  const action = result.bossResult.battle.actions.find((candidate) => candidate.actorSide === "party");
  if (action === undefined) throw new Error("party action이 없다");
  return action;
}

const morkanCocoonHelp = info({ bossRuleId: "boss-morkan-cocoon-side" as BossRuleId });
const morkanCocoonHarm = info({ outcome: "harm", bossRuleId: "boss-morkan-cocoon-side" as BossRuleId });
const morkanSpinHelp = info({ adviceId: "spin" as ChoiceId, bossRuleId: "boss-morkan-spin-pause" as BossRuleId });
const ragnaTurningHelp = info({ bossRuleId: "boss-ragna-turning" as BossRuleId });
const ragnaCrouchHelp = info({ adviceId: "crouch" as ChoiceId, bossRuleId: "boss-ragna-crouch" as BossRuleId });

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
    advicePressure: 0,
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

  it("두 outgoing help·merchant·조언 압력을 모두 곱한 뒤 한 번만 clamp한다", () => {
    const result = resolve({
      dungeon: dungeon({ bossId: SPIDER_BOSSES[1].id }),
      infoRecords: [
        info({ bossRuleId: "boss-morkan-cocoon-side" as BossRuleId }),
        info({ adviceId: "spin" as ChoiceId, bossRuleId: "boss-morkan-spin-pause" as BossRuleId }),
      ],
      classDefs: classesWithWarriorAttack(20),
      pendingMerchantEffect: { adviceId: "merchant" as ChoiceId, nextBattle: { partyDamageMultiplier: 0.5 } },
      advicePressure: 2,
    });

    expect(firstPartyAction(result).damage).toBe(14);
  });

  it("verification 순서를 characterId, bossRuleId, eventId, adviceId로 고정한다", () => {
    const result = resolve({
      infoRecords: [
        info({ eventId: "event-z" as EventId, adviceId: "advice-z" as ChoiceId, bossRuleId: "boss-ragna-turning" as BossRuleId }),
        info({ eventId: "event-a" as EventId, adviceId: "advice-a" as ChoiceId, bossRuleId: "boss-ragna-crouch" as BossRuleId }),
      ],
    });

    expect(result.bossResult.verifications.map(({ characterId, bossRuleId, eventId, adviceId }) =>
      `${characterId}/${bossRuleId}/${eventId}/${adviceId}`,
    )).toEqual([
      "member-1/boss-ragna-crouch/event-a/advice-a",
      "member-1/boss-ragna-turning/event-z/advice-z",
    ]);
  });

  it("cue는 실제 actionIndex를 가리키고 한 action당 하나만 남긴다", () => {
    const input = {
      dungeon: dungeon({ bossId: SPIDER_BOSSES[1].id }),
      classDefs: classesWithWarriorAttack(20),
      infoRecords: [morkanCocoonHelp, morkanSpinHelp],
    };
    const result = resolve(input);
    const firstActionIndex = result.bossResult.battle.actions.findIndex((action) => action.actorSide === "party");

    expect(result.bossResult.cues.filter((cue) => cue.actionIndex === firstActionIndex)).toHaveLength(1);
    expect(result.bossResult.cues).toContainEqual(expect.objectContaining({
      actionIndex: firstActionIndex,
      bossRuleId: "boss-morkan-cocoon-side",
    }));
    expect(new Set(result.bossResult.cues.map((cue) => cue.actionIndex)).size)
      .toBe(result.bossResult.cues.length);
    expect(resolve({ ...input, infoRecords: [...input.infoRecords].reverse() }).bossResult.cues)
      .toEqual(result.bossResult.cues);
  });

  it("같은 적 action의 targetWeight가 incomingDamage보다 먼저 선택된다", () => {
    const result = resolve({
      classDefs: classesWithWarriorAttack(1),
      infoRecords: [ragnaTurningHelp, ragnaCrouchHelp],
    });
    const enemyActionIndex = result.bossResult.battle.actions.findIndex((action) => action.actorSide === "enemy");

    expect(enemyActionIndex).toBeGreaterThanOrEqual(0);
    expect(result.bossResult.cues).toContainEqual(expect.objectContaining({
      actionIndex: enemyActionIndex,
      axis: "targetWeight",
      timing: "beforeTarget",
    }));
    expect(result.bossResult.cues.filter((cue) => cue.actionIndex === enemyActionIndex)).toHaveLength(1);
  });

  it("roundLimit을 생존자가 있는 wiped 결과로 만들지 않고 진단 오류로 중단한다", () => {
    const input = {
      members: [member("member-1", { hp: 999, maxHp: 999 })],
      classDefs: classesWithWarriorAttack(0),
      theme: themeWithBossStats({ maxHp: 999, baseDamage: 0 }),
    };

    expectRuleError(() => resolve(input), {
      code: "INVALID_GENERATION",
      details: { bossId: SPIDER_BOSSES[0].id, termination: "roundLimit", rounds: 50 },
    });
  });

  it("보스를 처치하고 한 명만 살아도 cleared와 해당 survivorIds를 반환한다", () => {
    const survivor = member("survivor");
    const deadMember = member("dead", { alive: false, hp: 0 });
    const result = resolve({
      members: [survivor, deadMember],
      classDefs: classesWithWarriorAttack(10),
      theme: themeWithBossStats({ maxHp: 1, baseDamage: 0 }),
    });

    expect(result.bossResult).toMatchObject({ status: "cleared", survivorIds: [survivor.id] });
  });

  it("accepted harm은 harmful application과 불리한 outgoing damage를 만든다", () => {
    const input = {
      dungeon: dungeon({ bossId: SPIDER_BOSSES[1].id }),
      classDefs: classesWithWarriorAttack(20),
    };
    const result = resolve({ ...input, infoRecords: [morkanCocoonHarm] });

    expect(result.bossResult.applications).toContainEqual(expect.objectContaining({
      bossRuleId: "boss-morkan-cocoon-side",
      axis: "outgoingDamage",
      direction: "harmful",
    }));
    expect(firstPartyAction(result).damage).toBeLessThan(firstPartyAction(resolve(input)).damage);
  });

  it("exposed delayed record는 trust나 verification을 만들지 않고 INVALID_GENERATION으로 거부한다", () => {
    const exposed = info({
      reaction: "exposed",
      pendingVerification: true,
    });

    expectRuleError(() => resolve({ infoRecords: [exposed] }), {
      code: "INVALID_GENERATION",
      details: {
        record: "boss-event/boss-advice/member-1",
        reaction: "exposed",
      },
    });
  });

  it.each([
    ["다른 보스 rule", [info({ bossRuleId: "boss-zakar-burrow-trace" as BossRuleId })]],
    ["중복 delayed record", [info(), info()]],
  ])("%s는 INVALID_GENERATION으로 거부한다", (_label, infoRecords) => {
    expect(() => resolve({ infoRecords })).toThrowError(RuleError);
  });

  it("초기 위험도의 공통 보정만 보스 능력치에 적용한다", () => {
    const expected = {
      maxHp: Math.max(1, Math.round(SPIDER_BOSSES[0].maxHp * 1.125)),
      baseDamage: Math.max(1, Math.round(SPIDER_BOSSES[0].baseDamage * 1.125)),
    };

    expect(balancedBossStats(SPIDER_BOSSES[0], 1)).toEqual(expected);
    expect(resolve({ dungeon: dungeon({ riskLevel: 1 }) }).bossResult.battle.enemies[0]?.maxHp).toBe(expected.maxHp);
    expect(resolve({ dungeon: dungeon({ riskLevel: 5 }) }).bossResult.battle.enemies[0]?.maxHp).toBe(expected.maxHp);
  });

  it("원정 조언 압력이 높을수록 보스전 파티 공격 피해가 줄어든다", () => {
    const safe = resolve({
      classDefs: classesWithWarriorAttack(20),
      advicePressure: 0,
    });
    const pressured = resolve({
      classDefs: classesWithWarriorAttack(20),
      advicePressure: 3,
    });

    expect(firstPartyAction(pressured).damage).toBeLessThan(firstPartyAction(safe).damage);
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
