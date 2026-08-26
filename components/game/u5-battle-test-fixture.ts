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
