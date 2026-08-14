import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/content/bosses";
import { BOSS_MODIFIER_MAX, BOSS_MODIFIER_MIN } from "@/lib/content/effects";
import { RuleError } from "@/lib/domain";
import type {
  BossDef,
  CampaignMember,
  CardId,
  ClassId,
  InfoRecord,
  InfoSubject,
  MemberId,
  TruthType,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { BOSS_DAMAGE_MODIFIERS } from "@/lib/rules/info";
import { TRUST_RULES } from "@/lib/rules/trust";
import { resolveBossFight } from "@/lib/rules/boss";

const BOSS_C = BOSSES.find((boss) => boss.grade === "C")!;
const BOSS_S = BOSSES.find((boss) => boss.grade === "S")!;

function member(
  id: string,
  currentHp = 100,
  overrides: Partial<CampaignMember> = {},
): CampaignMember {
  return {
    id: id as MemberId,
    name: id,
    classId: "warrior" as ClassId,
    personality: "prudent",
    currentHp,
    maxHp: 100,
    trust: 50,
    carriedGold: 20,
    alive: currentHp > 0,
    memory: [],
    ...overrides,
  };
}

function record(
  memberId: string,
  truthType: TruthType,
  reaction: InfoRecord["reaction"],
  subject: InfoSubject = "boss",
): InfoRecord {
  const modifier = subject === "boss" && reaction === "accepted"
    ? BOSS_DAMAGE_MODIFIERS[truthType]
    : 0;
  return {
    cardId: `card-${truthType}-${subject}` as CardId,
    truthType,
    subject,
    memberId: memberId as MemberId,
    reaction,
    modifier,
    pendingVerification: truthType === "lie" && reaction === "accepted",
  };
}

function fight(options: {
  boss?: BossDef;
  members: CampaignMember[];
  infoRecords?: InfoRecord[];
  seed?: string;
}) {
  return resolveBossFight({
    boss: options.boss ?? BOSS_C,
    members: options.members,
    infoRecords: options.infoRecords ?? [],
    rng: createRng(options.seed ?? "보스").derive("boss"),
  });
}

function resultFor(result: ReturnType<typeof fight>, memberId: string) {
  const entry = result.members.find((item) => item.member.id === memberId);
  if (entry === undefined) throw new Error(`없는 파티원이다: ${memberId}`);
  return entry;
}

describe("보스 피해 보정", () => {
  it("보스 주제 보정을 합산하고 상한과 하한으로 자른다", () => {
    const result = fight({
      members: [member("member-001"), member("member-002"), member("member-003")],
      infoRecords: [
        // 진실 -0.2 두 장이면 -0.4지만 하한이 -0.3이다.
        record("member-001", "truth", "accepted"),
        record("member-001", "truth", "accepted"),
        // 거짓 +0.25 세 장이면 +0.75지만 상한이 +0.5다.
        record("member-002", "lie", "accepted"),
        record("member-002", "lie", "accepted"),
        record("member-002", "lie", "accepted"),
      ],
    });

    expect(resultFor(result, "member-001").damageModifier).toBe(BOSS_MODIFIER_MIN);
    expect(resultFor(result, "member-002").damageModifier).toBe(BOSS_MODIFIER_MAX);
    expect(resultFor(result, "member-003").damageModifier).toBe(0);
  });

  it("보정은 기본 피해에 한 번만 적용되고 파티원마다 독립이다", () => {
    const result = fight({
      boss: BOSS_S,
      members: [member("member-001"), member("member-002")],
      infoRecords: [record("member-001", "truth", "accepted")],
    });

    expect(resultFor(result, "member-001").damage).toBe(Math.round(24 * 0.8));
    expect(resultFor(result, "member-002").damage).toBe(24);
    expect(resultFor(result, "member-001").member.currentHp).toBe(100 - 19);
    expect(resultFor(result, "member-002").member.currentHp).toBe(76);
  });

  it("보스 주제가 아니거나 의심·적발한 기록은 보정을 만들지 않는다", () => {
    const result = fight({
      members: [member("member-001")],
      infoRecords: [
        record("member-001", "truth", "accepted", "route"),
        record("member-001", "lie", "exposed"),
        record("member-001", "truth", "suspected"),
      ],
    });

    expect(resultFor(result, "member-001").damageModifier).toBe(0);
    expect(resultFor(result, "member-001").damage).toBe(BOSS_C.baseDamage);
  });
});

describe("생존과 전멸", () => {
  it("한 명이라도 살아남으면 클리어다", () => {
    const result = fight({
      boss: BOSS_S,
      members: [member("member-001", 10), member("member-002", 100)],
    });

    expect(result.outcome).toBe("clear");
    expect(result.survivorIds).toEqual(["member-002"]);
    expect(result.casualtyIds).toEqual(["member-001"]);
    expect(resultFor(result, "member-001").member.alive).toBe(false);
  });

  it("모두 죽으면 전멸이다", () => {
    const result = fight({
      boss: BOSS_S,
      members: [member("member-001", 10), member("member-002", 20)],
    });

    expect(result.outcome).toBe("wipe");
    expect(result.survivorIds).toEqual([]);
    expect(result.casualtyIds).toEqual(["member-001", "member-002"]);
  });

  it("이미 죽은 파티원은 보스전에 참여하지 않는다", () => {
    const dead = { ...member("member-002", 0), alive: false };
    const result = fight({ members: [member("member-001"), dead] });

    expect(result.members).toHaveLength(1);
    expect(result.survivorIds).toEqual(["member-001"]);
    expect(result.casualtyIds).toEqual([]);
  });

  it("살아 있는 파티원이 없으면 거부한다", () => {
    let caught: unknown;
    try {
      fight({ members: [{ ...member("member-001", 0), alive: false }] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RuleError);
    expect((caught as RuleError).code).toBe("INVALID_SETTLEMENT");
  });
});

describe("사후 검증", () => {
  it("수용한 거짓은 적발로 검증한다", () => {
    const result = fight({
      members: [member("member-001")],
      infoRecords: [record("member-001", "lie", "accepted")],
    });

    expect(result.verifications).toHaveLength(1);
    expect(result.verifications[0]).toMatchObject({
      memberId: "member-001",
      action: "deceptionExposed",
    });
    expect(result.verifications[0].change.reason)
      .toBe(TRUST_RULES.prudent.deceptionExposed.reason);
  });

  it("의심한 카드가 거짓이면 정당한 의심, 진실이나 중립이면 손해다", () => {
    const result = fight({
      members: [member("member-001"), member("member-002"), member("member-003")],
      infoRecords: [
        record("member-001", "lie", "suspected"),
        record("member-002", "truth", "suspected"),
        record("member-003", "neutral", "suspected"),
      ],
    });

    expect(result.verifications.map((entry) => entry.action)).toEqual([
      "suspicionWasCorrect",
      "suspicionWasCostly",
      "suspicionWasCostly",
    ]);
  });

  it("수용한 진실·중립과 즉시 적발은 다시 검증하지 않는다", () => {
    const result = fight({
      members: [member("member-001")],
      infoRecords: [
        record("member-001", "truth", "accepted"),
        record("member-001", "neutral", "accepted"),
        record("member-001", "lie", "exposed"),
      ],
    });

    expect(result.verifications).toEqual([]);
  });

  it("보스전에서 죽은 파티원은 검증하지 않는다", () => {
    const result = fight({
      boss: BOSS_S,
      members: [member("member-001", 10), member("member-002", 100)],
      infoRecords: [
        record("member-001", "lie", "accepted"),
        record("member-002", "lie", "accepted"),
      ],
    });

    expect(result.members.find((entry) => entry.member.id === "member-001")!.member.alive)
      .toBe(false);
    expect(result.verifications.map((entry) => entry.memberId)).toEqual(["member-002"]);
  });

  it("검증한 신뢰 변화가 결과 파티원에 반영된다", () => {
    const result = fight({
      members: [member("member-001", 100, { trust: 50 })],
      infoRecords: [record("member-001", "lie", "accepted")],
    });

    expect(resultFor(result, "member-001").member.trust).toBeLessThan(50);
    expect(resultFor(result, "member-001").member.trust)
      .toBe(result.verifications[0].change.delta + 50);
  });
});

describe("재현성과 불변성", () => {
  it("같은 입력과 시드는 같은 결과를 낸다", () => {
    const run = () => fight({
      members: [member("member-001"), member("member-002")],
      infoRecords: [record("member-001", "lie", "accepted")],
      seed: "재현",
    });

    expect(run()).toEqual(run());
  });

  it("입력 파티원과 기록을 바꾸지 않는다", () => {
    const members = [member("member-001")];
    const infoRecords = [record("member-001", "lie", "accepted")];
    const snapshot = structuredClone({ members, infoRecords });
    fight({ members, infoRecords });

    expect({ members, infoRecords }).toEqual(snapshot);
  });
});
