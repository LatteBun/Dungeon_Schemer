import { describe, expect, it } from "vitest";
import { CLASSES } from "@/lib/content/classes";
import { SPIDER_BOSSES } from "@/lib/content/themes";
import { resolveBossBattle } from "@/lib/rules/boss-battle-adapter";
import type { CharacterId, ChoiceId, ClassId } from "@/lib/domain";

describe("E4 보스 BattleEngine adapter", () => {
  it("보스 정보 multiplier와 merchant pending을 같은 공통 엔진 입력으로 전달한다", () => {
    const member = { id: "member-1" as CharacterId, name: "전사", classId: "warrior" as ClassId, personality: "prudent" as const, maxHp: 45, hp: 45, trust: 50, gold: 10, alive: true, gravelyWounded: false };
    const result = resolveBossBattle({
      boss: SPIDER_BOSSES[0],
      members: [member],
      classDefs: CLASSES,
      seed: "boss-adapter",
      retrySteps: 0,
      pendingMerchantEffect: { adviceId: "merchant-1" as ChoiceId, nextBattle: { incomingDamageMultiplier: 0.5 } },
      memberBossDamageMultipliers: { [member.id]: 0.8 },
    });
    expect(result.battle.actions.length).toBeGreaterThan(0);
    expect(result.pendingMerchantEffect).toBeNull();
  });
});
