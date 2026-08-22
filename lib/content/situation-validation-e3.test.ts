import { describe, expect, it } from "vitest";
import { validateEncounterDefinition, validateEncounterModifier } from "@/lib/content/situation-validation";
import { RuleError } from "@/lib/domain";
import type { EncounterDefinition, MonsterId } from "@/lib/domain";

const id = (value: string) => value as MonsterId;
const base: EncounterDefinition = { enemies: [{ monsterId: id("mage"), count: 2 }, { monsterId: id("archer"), count: 1 }] };
const invalidGeneration = (run: () => void, message = /INVALID_GENERATION|MonsterId|remove|add/) => {
  expect(run).toThrow(RuleError);
  expect(() => run()).toThrow(message);
};

describe("E3 encounter 정적 검증", () => {
  it("중복 base MonsterId를 거부한다", () => invalidGeneration(() => validateEncounterDefinition({ enemies: [{ monsterId: id("mage"), count: 1 }, { monsterId: id("mage"), count: 1 }] })));
  it("중복 add/remove와 overlap을 거부한다", () => {
    invalidGeneration(() => validateEncounterModifier(base, { addEnemies: [{ monsterId: id("rogue"), count: 1 }, { monsterId: id("rogue"), count: 1 }] }));
    invalidGeneration(() => validateEncounterModifier(base, { removeEnemies: [{ monsterId: id("mage"), count: 1 }], addEnemies: [{ monsterId: id("mage"), count: 1 }] }));
  });
  it("unknown remove와 underflow를 거부한다", () => {
    invalidGeneration(() => validateEncounterModifier(base, { removeEnemies: [{ monsterId: id("cleric"), count: 1 }] }));
    invalidGeneration(() => validateEncounterModifier(base, { removeEnemies: [{ monsterId: id("mage"), count: 3 }] }));
  });
  it("전투 배율의 음수와 0을 거부한다", () => {
    invalidGeneration(() => validateEncounterModifier(base, { partyDamageMultiplier: 0 }), /partyDamageMultiplier/);
    invalidGeneration(() => validateEncounterModifier(base, { incomingDamageMultiplier: -1 }), /incomingDamageMultiplier/);
  });
});
