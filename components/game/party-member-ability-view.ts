import {
  RuleError,
  type ClassBattleAbilityDef,
} from "@/lib/domain";

export interface PartyMemberBattleAbilityStatus {
  readonly label: string;
  readonly remaining: number;
  readonly total: number;
}

function assertRemaining(remaining: number | undefined, total: number): asserts remaining is number {
  if (!Number.isSafeInteger(remaining) || remaining === undefined || remaining < 0 || remaining > total) {
    throw new RuleError(
      "INVALID_GENERATION",
      "파티 카드의 전투 능력 잔여 횟수가 유효하지 않다",
      { remaining, total },
    );
  }
}

/** 직업 능력 정의와 화면별 현재 횟수를 공통 카드 상태로 좁힌다. */
export function partyMemberBattleAbilityStatus(
  ability: ClassBattleAbilityDef | undefined,
  remaining: number | undefined,
): PartyMemberBattleAbilityStatus | undefined {
  if (ability === undefined) return undefined;
  assertRemaining(remaining, ability.usesPerExpedition);

  switch (ability.kind) {
    case "emergencyHeal":
      return {
        label: "치유",
        remaining,
        total: ability.usesPerExpedition,
      };
  }
}

/** U5 replay frame은 확정 HP·신뢰와 독립적으로 현재 횟수만 되감는다. */
export function withPartyMemberBattleAbilityRemaining(
  status: PartyMemberBattleAbilityStatus,
  remaining: number,
): PartyMemberBattleAbilityStatus {
  assertRemaining(remaining, status.total);
  return { ...status, remaining };
}
