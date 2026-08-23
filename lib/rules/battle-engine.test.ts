import { describe, expect, it } from "vitest";
import { resolveBattle } from "@/lib/rules/battle-engine";

const party = [
  { id: "warrior", classId: "warrior", hp: 20, maxHp: 20, attack: 6, hitWeight: 3 },
  { id: "mage", classId: "mage", hp: 20, maxHp: 20, attack: 9, hitWeight: 1 },
];

describe("공통 BattleEngine", () => {
  it("party phase 후 살아 있는 적이 없으면 enemy phase를 생략한다", () => {
    const result = resolveBattle({
      seed: "battle-1",
      party,
      enemies: [{ id: "rat#1", monsterId: "rat", hp: 1, maxHp: 1, baseDamage: 5 }],
    });
    expect(result.status).toBe("victory");
    expect(result.actions.some((action) => action.actorSide === "enemy")).toBe(false);
  });

  it("동일 입력은 action record까지 결정적이고 50라운드에 wipe한다", () => {
    const input = {
      seed: "battle-2",
      party: [{ ...party[0], attack: 0 }],
      enemies: [{ id: "ogre#1", monsterId: "ogre", hp: 999, maxHp: 999, baseDamage: 0 }],
    };
    const first = resolveBattle(input);
    expect(first.status).toBe("wipe");
    expect(first.rounds).toBe(50);
    expect(first.termination).toBe("roundLimit");
    expect(first).toEqual(resolveBattle(input));
  });

  it("파티가 전멸하면 roundLimit과 구분되는 partyWipe를 기록한다", () => {
    const result = resolveBattle({
      seed: "battle-party-wipe",
      party: [{ ...party[0], hp: 1, attack: 0 }],
      enemies: [{ id: "ogre#1", monsterId: "ogre", hp: 10, maxHp: 10, baseDamage: 5 }],
    });
    expect(result.status).toBe("wipe");
    expect(result.termination).toBe("partyWipe");
  });

  it("적 target weight는 직업 hitWeight와 modifier의 곱이다", () => {
    const result = resolveBattle({
      seed: "battle-3",
      party,
      enemies: [{ id: "rat#1", monsterId: "rat", hp: 50, maxHp: 50, baseDamage: 1 }],
      targetWeightMultipliers: { warrior: 2, mage: 0.5 },
    });
    expect(result.actions.find((action) => action.actorSide === "enemy")?.targetId).toBeDefined();
  });

  it("적별 target weight를 적용한다", () => {
    const result = resolveBattle({
      seed: "battle-enemy-target-weight",
      party,
      enemies: [{ id: "hunter#1", monsterId: "hunter", hp: 50, maxHp: 50, baseDamage: 1, targetWeightMultipliers: { warrior: 0, mage: 10 } }],
    });
    expect(result.actions.find((action) => action.actorSide === "enemy")?.targetId).toBe("mage");
  });

  it("같은 직업이어도 member ID별 target weight를 적용한다", () => {
    const result = resolveBattle({
      seed: "battle-member-target-weight",
      party: [
        { id: "warrior-a", classId: "warrior", hp: 20, maxHp: 20, attack: 0, hitWeight: 1 },
        { id: "warrior-b", classId: "warrior", hp: 20, maxHp: 20, attack: 0, hitWeight: 1 },
      ],
      enemies: [{ id: "rat#1", monsterId: "rat", hp: 50, maxHp: 50, baseDamage: 1 }],
      targetWeightMultiplierByMemberId: { "warrior-a": 0.01, "warrior-b": 100 },
    });
    expect(result.actions.find((action) => action.actorSide === "enemy")?.targetId).toBe("warrior-b");
  });

  it("outgoing damage를 member ID별로 적용한다", () => {
    const result = resolveBattle({
      seed: "battle-member-outgoing",
      party: [{ id: "warrior-a", classId: "warrior", hp: 20, maxHp: 20, attack: 10, hitWeight: 1 }],
      enemies: [{ id: "rat#1", monsterId: "rat", hp: 50, maxHp: 50, baseDamage: 0 }],
      outgoingDamageMultiplierByMemberId: { "warrior-a": 0.8 },
    });
    expect(result.actions[0]?.damage).toBe(8);
  });
});
