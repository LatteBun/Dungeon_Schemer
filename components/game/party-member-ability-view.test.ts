import { describe, expect, it } from "vitest";
import { RuleError, type ClassBattleAbilityDef } from "@/lib/domain";
import {
  partyMemberBattleAbilityStatus,
  withPartyMemberBattleAbilityRemaining,
} from "./party-member-ability-view";

const emergencyHeal: ClassBattleAbilityDef = {
  kind: "emergencyHeal",
  name: "치유 기도",
  healTargetMaxHpPercent: 25,
  usesPerExpedition: 2,
  triggerAtOrBelowHpPercent: 50,
};

describe("party member ability view", () => {
  it("능력이 없는 직업은 카드 상태를 만들지 않는다", () => {
    expect(partyMemberBattleAbilityStatus(undefined, undefined)).toBeUndefined();
  });

  it.each([
    [2, { label: "치유", remaining: 2, total: 2 }],
    [1, { label: "치유", remaining: 1, total: 2 }],
    [0, { label: "치유", remaining: 0, total: 2 }],
  ] as const)("응급 치유 %i회를 공통 카드 상태로 바꾼다", (remaining, expected) => {
    const status = partyMemberBattleAbilityStatus(emergencyHeal, remaining);

    expect(status).toEqual(expected);
    expect(status?.label).not.toBe("치유 기도");
  });

  it.each([-1, 3, 0.5, Number.NaN])("범위를 벗어난 source %s를 거부한다", (remaining) => {
    expect(() => partyMemberBattleAbilityStatus(emergencyHeal, remaining)).toThrowError(RuleError);
  });

  it("replay frame 횟수로 기존 상태의 현재값만 교체한다", () => {
    expect(withPartyMemberBattleAbilityRemaining(
      { label: "치유", remaining: 0, total: 2 },
      1,
    )).toEqual({ label: "치유", remaining: 1, total: 2 });
  });
});
