import { describe, expect, it } from "vitest";
import { BOSSES } from "@/lib/content/bosses";
import { CLASSES } from "@/lib/content/classes";
import { BOSS_MODIFIER_MAX, BOSS_MODIFIER_MIN } from "@/lib/content/effects";
import { RuleError } from "@/lib/domain";
import type {
  BossDef,
  CampaignMember,
  CardId,
  ClassDef,
  InfoRecord,
  InfoSubject,
  MemberId,
  TruthType,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { BOSS_DAMAGE_MODIFIERS } from "@/lib/rules/info";
import { TRUST_RULES } from "@/lib/rules/trust";
import { MAX_BOSS_TURNS, resolveBossFight } from "@/lib/rules/boss";

const BOSS_C = BOSSES.find((boss) => boss.grade === "C")!;
const BOSS_S = BOSSES.find((boss) => boss.grade === "S")!;
const WARRIOR = CLASSES.find((entry) => entry.name === "전사")!;
const MAGE = CLASSES.find((entry) => entry.name === "마법사")!;
const CLERIC = CLASSES.find((entry) => entry.name === "성직자")!;

function member(
  id: string,
  currentHp = 100,
  overrides: Partial<CampaignMember> = {},
): CampaignMember {
  return {
    id: id as MemberId,
    name: id,
    classId: WARRIOR.id,
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
  classes?: readonly ClassDef[];
}) {
  return resolveBossFight({
    boss: options.boss ?? BOSS_C,
    members: options.members,
    infoRecords: options.infoRecords ?? [],
    rng: createRng(options.seed ?? "보스").derive("boss"),
    classes: options.classes ?? CLASSES,
  });
}

function resultFor(result: ReturnType<typeof fight>, memberId: string) {
  const entry = result.members.find((item) => item.member.id === memberId);
  if (entry === undefined) throw new Error(`없는 파티원이다: ${memberId}`);
  return entry;
}

/** 전사 하나와 마법사 하나. 피격 가중치가 4 대 1이라 분포를 보기 좋다. */
function mixedParty(hp = 100): CampaignMember[] {
  return [
    member("member-warrior", hp, { classId: WARRIOR.id }),
    member("member-mage", hp, { classId: MAGE.id }),
  ];
}

describe("턴 진행", () => {
  it("파티가 먼저 치고 보스가 되받는다", () => {
    const party = mixedParty();
    const result = fight({ members: party });
    const first = result.turns[0];

    expect(first.turn).toBe(1);
    expect(first.partyDamage).toBe(WARRIOR.attack + MAGE.attack);
    expect(first.bossHpAfter).toBe(BOSS_C.maxHp - first.partyDamage);
    expect(first.targetId).not.toBeNull();
    expect(first.damage).toBe(BOSS_C.baseDamage);
  });

  it("보스가 쓰러진 턴에는 반격하지 않는다", () => {
    const result = fight({ members: mixedParty() });
    const last = result.turns[result.turns.length - 1];

    expect(result.outcome).toBe("clear");
    expect(result.bossHpRemaining).toBe(0);
    expect(last.bossHpAfter).toBe(0);
    expect(last.targetId).toBeNull();
    expect(last.damage).toBe(0);
  });

  it("보스 HP를 파티 화력으로 나눈 만큼 턴이 걸린다", () => {
    const party = mixedParty();
    const perTurn = WARRIOR.attack + MAGE.attack;
    const result = fight({ members: party });

    expect(result.turns).toHaveLength(Math.ceil(BOSS_C.maxHp / perTurn));
  });

  it("파티원이 죽으면 다음 턴 화력이 줄어든다", () => {
    // 전사만 한 방에 죽도록 HP를 낮춰 둔다.
    const result = fight({
      boss: BOSS_S,
      members: [
        member("member-warrior", 10, { classId: WARRIOR.id }),
        member("member-mage", 100, { classId: MAGE.id }),
      ],
      seed: "화력감소",
    });
    const died = result.turns.findIndex((entry) => entry.targetHpAfter === 0);

    expect(died).toBeGreaterThanOrEqual(0);
    const after = result.turns[died + 1];
    if (after !== undefined) {
      expect(after.partyDamage).toBeLessThan(result.turns[died].partyDamage);
    }
  });

  it("파티원이 순서대로 한 명씩 치고 각 타격이 기록된다", () => {
    const result = fight({ boss: BOSS_S, members: mixedParty(), seed: "타격기록" });
    const first = result.turns[0];

    expect(first.attacks.map((entry) => entry.memberId))
      .toEqual(["member-warrior", "member-mage"]);
    expect(first.attacks.map((entry) => entry.damage))
      .toEqual([WARRIOR.attack, MAGE.attack]);
    expect(first.attacks[0].bossHpAfter).toBe(BOSS_S.maxHp - WARRIOR.attack);
    expect(first.attacks[1].bossHpAfter)
      .toBe(BOSS_S.maxHp - WARRIOR.attack - MAGE.attack);
  });

  it("보스가 도중에 쓰러지면 남은 파티원은 치지 않는다", () => {
    // 전사 한 방이면 죽는 보스를 만든다.
    const frail: BossDef = { ...BOSS_C, maxHp: WARRIOR.attack };
    const result = fight({ boss: frail, members: mixedParty(), seed: "조기격파" });

    expect(result.turns).toHaveLength(1);
    expect(result.turns[0].attacks).toHaveLength(1);
    expect(result.turns[0].attacks[0].memberId).toBe("member-warrior");
    expect(result.outcome).toBe("clear");
  });

  it("각 타격의 합이 그 턴의 partyDamage와 같다", () => {
    const result = fight({ boss: BOSS_S, members: mixedParty(), seed: "합계" });

    for (const entry of result.turns) {
      const sum = entry.attacks.reduce((total, attack) => total + attack.damage, 0);
      expect(sum).toBe(entry.partyDamage);
    }
  });

  it("보스 최대 HP를 결과에 담아 화면이 비율을 그릴 수 있다", () => {
    const result = fight({ boss: BOSS_S, members: mixedParty(), seed: "최대HP" });

    expect(result.bossMaxHp).toBe(BOSS_S.maxHp);
  });

  it("턴 기록의 보스 HP가 실제 누적과 일치한다", () => {
    const result = fight({ boss: BOSS_S, members: mixedParty(), seed: "누적" });
    let hp = BOSS_S.maxHp;

    for (const entry of result.turns) {
      hp = Math.max(0, hp - entry.partyDamage);
      expect(entry.bossHpAfter).toBe(hp);
    }
    expect(result.bossHpRemaining).toBe(hp);
  });
});

describe("피격 대상 선택", () => {
  it("피격 가중치가 높은 직업이 통계적으로 더 많이 맞는다", () => {
    let warriorHits = 0;
    let mageHits = 0;

    for (let index = 0; index < 200; index += 1) {
      const result = fight({
        boss: BOSS_S,
        members: mixedParty(1000),
        seed: `분포-${index}`,
      });
      warriorHits += resultFor(result, "member-warrior").hits;
      mageHits += resultFor(result, "member-mage").hits;
    }

    // 가중치 4 대 1이므로 전사가 압도적으로 많이 맞아야 한다.
    expect(warriorHits).toBeGreaterThan(mageHits * 2);
  });

  it("전사가 죽으면 남은 사람들이 피해를 나눠 받는다", () => {
    const result = fight({
      boss: BOSS_S,
      members: [
        member("member-warrior", 1, { classId: WARRIOR.id }),
        member("member-mage", 1000, { classId: MAGE.id }),
        member("member-cleric", 1000, { classId: CLERIC.id }),
      ],
      seed: "전사사망",
    });

    expect(resultFor(result, "member-warrior").member.alive).toBe(false);
    const rest = resultFor(result, "member-mage").hits
      + resultFor(result, "member-cleric").hits;
    expect(rest).toBeGreaterThan(0);
  });

  it("살아 있는 사람만 맞는다", () => {
    const result = fight({
      boss: BOSS_S,
      members: [member("member-001", 1), member("member-002", 1000)],
      seed: "생존자만",
    });
    const byTurn = new Map(result.turns.map((entry) => [entry.turn, entry]));
    const deathTurn = result.turns.find((entry) => entry.targetHpAfter === 0);

    if (deathTurn !== undefined) {
      for (const [turn, entry] of byTurn) {
        if (turn > deathTurn.turn) {
          expect(entry.targetId).not.toBe(deathTurn.targetId);
        }
      }
    }
  });
});

describe("보스 피해 보정", () => {
  it("보스 주제 보정을 합산하고 상한과 하한으로 자른다", () => {
    const result = fight({
      boss: BOSS_S,
      members: [
        member("member-001", 1000),
        member("member-002", 1000),
        member("member-003", 1000),
      ],
      infoRecords: [
        record("member-001", "truth", "accepted"),
        record("member-001", "truth", "accepted"),
        record("member-002", "lie", "accepted"),
        record("member-002", "lie", "accepted"),
        record("member-002", "lie", "accepted"),
      ],
      seed: "상한",
    });

    expect(resultFor(result, "member-001").damageModifier).toBe(BOSS_MODIFIER_MIN);
    expect(resultFor(result, "member-002").damageModifier).toBe(BOSS_MODIFIER_MAX);
    expect(resultFor(result, "member-003").damageModifier).toBe(0);
  });

  it("보정은 맞을 때마다 적용되고 합계는 맞은 횟수에 비례한다", () => {
    const result = fight({
      boss: BOSS_S,
      members: mixedParty(1000),
      infoRecords: [record("member-warrior", "truth", "accepted")],
      seed: "매턴보정",
    });
    const warrior = resultFor(result, "member-warrior");
    const perHit = Math.round(BOSS_S.baseDamage * (1 + BOSS_MODIFIER_MIN * (2 / 3)));

    expect(warrior.damageModifier).toBe(BOSS_DAMAGE_MODIFIERS.truth);
    expect(warrior.damage).toBe(warrior.hits * perHit);
  });

  it("보스 주제가 아니거나 의심·적발한 기록은 보정을 만들지 않는다", () => {
    const result = fight({
      members: [member("member-001", 1000)],
      infoRecords: [
        record("member-001", "truth", "accepted", "route"),
        record("member-001", "lie", "exposed"),
        record("member-001", "truth", "suspected"),
      ],
      seed: "보정없음",
    });
    const entry = resultFor(result, "member-001");

    expect(entry.damageModifier).toBe(0);
    expect(entry.damage).toBe(entry.hits * BOSS_C.baseDamage);
  });
});

describe("생존과 전멸", () => {
  it("한 명이라도 살아남으면 클리어다", () => {
    const result = fight({
      members: [
        member("member-001", 1, { classId: WARRIOR.id }),
        member("member-002", 1000, { classId: MAGE.id }),
      ],
      seed: "부분생존",
    });

    expect(result.outcome).toBe("clear");
    expect(result.survivorIds).toContain("member-002");
  });

  it("모두 죽으면 전멸이고 보스 HP가 남는다", () => {
    const result = fight({
      boss: BOSS_S,
      members: [member("member-001", 5), member("member-002", 5)],
      seed: "전멸",
    });

    expect(result.outcome).toBe("wipe");
    expect(result.survivorIds).toEqual([]);
    expect(result.casualtyIds).toHaveLength(2);
    expect(result.bossHpRemaining).toBeGreaterThan(0);
  });

  it("이미 죽은 파티원은 보스전에 참여하지 않는다", () => {
    const dead = { ...member("member-002", 0), alive: false };
    const result = fight({ members: [member("member-001", 1000), dead] });

    expect(result.members).toHaveLength(1);
    expect(result.survivorIds).toEqual(["member-001"]);
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

  it("공격력이 0이면 턴 상한에서 멈추고 전멸로 끝난다", () => {
    const harmless = CLASSES.map((entry) => ({ ...entry, attack: 0 }));
    const result = fight({
      members: [member("member-001", 1_000_000)],
      classes: harmless,
      seed: "무한루프",
    });

    expect(result.turns).toHaveLength(MAX_BOSS_TURNS);
    expect(result.outcome).toBe("wipe");
    expect(result.bossHpRemaining).toBe(BOSS_C.maxHp);
  });
});

describe("사후 검증", () => {
  it("수용한 거짓은 적발로 검증한다", () => {
    const result = fight({
      members: [member("member-001", 1000)],
      infoRecords: [record("member-001", "lie", "accepted")],
      seed: "적발",
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
      members: [
        member("member-001", 1000),
        member("member-002", 1000),
        member("member-003", 1000),
      ],
      infoRecords: [
        record("member-001", "lie", "suspected"),
        record("member-002", "truth", "suspected"),
        record("member-003", "neutral", "suspected"),
      ],
      seed: "의심검증",
    });

    expect(result.verifications.map((entry) => entry.action)).toEqual([
      "suspicionWasCorrect",
      "suspicionWasCostly",
      "suspicionWasCostly",
    ]);
  });

  it("수용한 진실·중립과 즉시 적발은 다시 검증하지 않는다", () => {
    const result = fight({
      members: [member("member-001", 1000)],
      infoRecords: [
        record("member-001", "truth", "accepted"),
        record("member-001", "neutral", "accepted"),
        record("member-001", "lie", "exposed"),
      ],
      seed: "재검증없음",
    });

    expect(result.verifications).toEqual([]);
  });

  it("보스전에서 죽은 파티원은 검증하지 않는다", () => {
    const result = fight({
      boss: BOSS_S,
      members: [
        member("member-001", 1, { classId: WARRIOR.id }),
        member("member-002", 1000, { classId: MAGE.id }),
      ],
      infoRecords: [
        record("member-001", "lie", "accepted"),
        record("member-002", "lie", "accepted"),
      ],
      seed: "사망자검증",
    });

    expect(resultFor(result, "member-001").member.alive).toBe(false);
    expect(result.verifications.map((entry) => entry.memberId)).toEqual(["member-002"]);
  });

  it("검증한 신뢰 변화가 결과 파티원에 반영된다", () => {
    const result = fight({
      members: [member("member-001", 1000, { trust: 50 })],
      infoRecords: [record("member-001", "lie", "accepted")],
      seed: "신뢰반영",
    });

    expect(resultFor(result, "member-001").member.trust).toBeLessThan(50);
    expect(resultFor(result, "member-001").member.trust)
      .toBe(result.verifications[0].change.delta + 50);
  });
});

describe("재현성과 불변성", () => {
  it("같은 입력과 시드는 같은 전투를 재현한다", () => {
    const run = () => fight({
      boss: BOSS_S,
      members: mixedParty(),
      infoRecords: [record("member-warrior", "lie", "accepted")],
      seed: "재현",
    });

    expect(run()).toEqual(run());
  });

  it("시드가 다르면 피격 순서가 달라질 수 있다", () => {
    const orders = new Set(
      Array.from({ length: 20 }, (_, index) =>
        fight({ boss: BOSS_S, members: mixedParty(1000), seed: `순서-${index}` })
          .turns.map((entry) => entry.targetId).join("|")),
    );

    expect(orders.size).toBeGreaterThan(1);
  });

  it("입력 파티원과 기록을 바꾸지 않는다", () => {
    const members = mixedParty();
    const infoRecords = [record("member-warrior", "lie", "accepted")];
    const snapshot = structuredClone({ members, infoRecords });
    fight({ members, infoRecords });

    expect({ members, infoRecords }).toEqual(snapshot);
  });
});
