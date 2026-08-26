import type { BattleResolution } from "@/lib/rules/battle-engine";
import { createU5BattleReplay } from "./u5-battle-replay";

const resolution: BattleResolution = {
  status: "victory",
  termination: "defeatedEnemies",
  rounds: 1,
  actions: [
    { kind: "attack", round: 1, actorSide: "party", actorId: "party-1", targetId: "enemy-1", damage: 7, targetHpBefore: 7, targetHpAfter: 0, defeated: true },
  ],
  party: [{ id: "party-1", classId: "warrior", hp: 10, maxHp: 10, attack: 7, hitWeight: 3 }],
  enemies: [{ id: "enemy-1", monsterId: "spider-hatchling", hp: 0, maxHp: 7, baseDamage: 3 }],
};

export const U5_TEST_BATTLE_REPLAY = createU5BattleReplay({
  resolution,
  presentations: [
    { id: "party-1", name: "코르빈", imageSrc: "/assets/characters/live/warrior/warrior_a.png" },
    { id: "enemy-1", name: "새끼거미", imageSrc: "/assets/monsters/spider/monster-spider-hatchling.png" },
  ],
});

const emergencyHeal = {
  kind: "emergencyHeal",
  name: "치유 기도",
  healTargetMaxHpPercent: 25,
  usesPerExpedition: 2,
  triggerAtOrBelowHpPercent: 50,
} as const;

/** 치유 1회 뒤 공격으로 끝나는 결정적 U5 표현 fixture. */
export const U5_TEST_HEALING_BATTLE_REPLAY = createU5BattleReplay({
  resolution: {
    status: "victory",
    termination: "defeatedEnemies",
    rounds: 1,
    actions: [
      { kind: "heal", round: 1, actorSide: "party", actorId: "cleric", targetId: "ally", abilityKind: "emergencyHeal", healing: 11, targetHpBefore: 2, targetHpAfter: 13 },
      { kind: "attack", round: 1, actorSide: "party", actorId: "ally", targetId: "enemy-1", damage: 7, targetHpBefore: 7, targetHpAfter: 0, defeated: true },
    ],
    party: [
      { id: "cleric", classId: "cleric", hp: 10, maxHp: 10, attack: 3, hitWeight: 1, battleAbility: { ...emergencyHeal, remainingUses: 1 } },
      { id: "ally", classId: "warrior", hp: 13, maxHp: 45, attack: 7, hitWeight: 3 },
    ],
    enemies: [{ id: "enemy-1", monsterId: "spider-hatchling", hp: 0, maxHp: 7, baseDamage: 3 }],
  },
  presentations: [
    { id: "cleric", name: "세라핀", imageSrc: "/assets/characters/live/cleric/cleric_a.png" },
    { id: "ally", name: "코르빈", imageSrc: "/assets/characters/live/warrior/warrior_a.png" },
    { id: "enemy-1", name: "새끼거미", imageSrc: "/assets/monsters/spider/monster-spider-hatchling.png" },
  ],
});
