import { validateClasses } from "@/lib/content/class-validation";
import {
  RuleError,
  type BattleAbilityUsesRemaining,
  type BattlePartyMember,
  type BattlePartyMemberAbilityState,
  type Character,
  type ClassDef,
  type RuleErrorCode,
} from "@/lib/domain";

type AbilityStateErrorCode = Extract<RuleErrorCode, "INVALID_GENERATION" | "INVALID_TRANSITION">;

function invalid(
  errorCode: AbilityStateErrorCode,
  message: string,
  details: Record<string, unknown> = {},
): never {
  throw new RuleError(errorCode, message, details);
}

function assertUsesMap(
  value: unknown,
  errorCode: AbilityStateErrorCode,
): asserts value is BattleAbilityUsesRemaining {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalid(errorCode, "전투 능력 잔여 횟수 맵이 객체가 아니다", { value });
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    invalid(errorCode, "전투 능력 잔여 횟수 맵이 record 객체가 아니다", {
      objectType: Object.prototype.toString.call(value),
    });
  }
}

function classDefinitionsById(
  classDefs: readonly ClassDef[],
): ReadonlyMap<string, ClassDef> {
  validateClasses(classDefs);
  return new Map(classDefs.map((classDef) => [classDef.id, classDef]));
}

function classForMember(
  member: Character,
  byId: ReadonlyMap<string, ClassDef>,
  errorCode: AbilityStateErrorCode,
): ClassDef {
  const classDef = byId.get(member.classId);
  if (classDef === undefined) {
    invalid(errorCode, "파티원의 직업 정의가 없다", {
      characterId: member.id,
      classId: member.classId,
    });
  }
  return classDef;
}

function assertDistinctMembers(
  members: readonly Character[],
  errorCode: AbilityStateErrorCode,
): void {
  const seen = new Set<string>();
  for (const member of members) {
    if (seen.has(member.id)) {
      invalid(errorCode, "원정 파티원 ID가 중복된다", { characterId: member.id });
    }
    seen.add(member.id);
  }
}

function ownValue(
  usesRemaining: BattleAbilityUsesRemaining,
  characterId: Character["id"],
): number | undefined {
  return Object.prototype.hasOwnProperty.call(usesRemaining, characterId)
    ? usesRemaining[characterId]
    : undefined;
}

function assertRemainingUses(
  value: number | undefined,
  maximum: number,
  characterId: Character["id"],
  phase: "start" | "active",
  errorCode: AbilityStateErrorCode,
): asserts value is number {
  const valid = Number.isSafeInteger(value)
    && value !== undefined
    && (phase === "start" ? value === maximum : value >= 0 && value <= maximum);
  if (!valid) {
    invalid(errorCode, "전투 능력 잔여 횟수가 유효하지 않다", {
      characterId,
      value,
      maximum,
      phase,
    });
  }
}

/** 현재 파티의 능력 보유자만 원정 초기 횟수로 만든다. */
export function createBattleAbilityUsesForParty(input: {
  readonly members: readonly Character[];
  readonly classDefs: readonly ClassDef[];
}): BattleAbilityUsesRemaining {
  const byId = classDefinitionsById(input.classDefs);
  assertDistinctMembers(input.members, "INVALID_GENERATION");
  const result: Partial<Record<Character["id"], number>> = {};

  for (const member of input.members) {
    const ability = classForMember(member, byId, "INVALID_GENERATION").battleAbility;
    if (ability !== undefined) result[member.id] = ability.usesPerExpedition;
  }

  return result;
}

/** 직업 능력 정의와 원정 잔여 횟수를 전투원 런타임 상태로 결합한다. */
export function hydrateBattlePartyAbility(input: {
  readonly member: Character;
  readonly classDef: ClassDef;
  readonly usesRemaining: BattleAbilityUsesRemaining;
}): BattlePartyMemberAbilityState | undefined {
  validateClasses([input.classDef]);
  assertUsesMap(input.usesRemaining, "INVALID_GENERATION");
  if (input.member.classId !== input.classDef.id) {
    invalid("INVALID_GENERATION", "파티원과 직업 정의가 일치하지 않는다", {
      characterId: input.member.id,
      memberClassId: input.member.classId,
      classDefId: input.classDef.id,
    });
  }

  const ability = input.classDef.battleAbility;
  if (ability === undefined) {
    if (Object.prototype.hasOwnProperty.call(input.usesRemaining, input.member.id)) {
      invalid("INVALID_GENERATION", "능력이 없는 파티원에게 잔여 횟수 키가 있다", {
        characterId: input.member.id,
      });
    }
    return undefined;
  }

  const remainingUses = ownValue(input.usesRemaining, input.member.id);
  assertRemainingUses(
    remainingUses,
    ability.usesPerExpedition,
    input.member.id,
    "active",
    "INVALID_GENERATION",
  );
  return { ...ability, remainingUses };
}

/** 원정 맵의 키 집합과 각 잔여 횟수 범위를 검증한다. */
export function validateBattleAbilityUses(input: {
  readonly members: readonly Character[];
  readonly classDefs: readonly ClassDef[];
  readonly usesRemaining: BattleAbilityUsesRemaining;
  readonly phase: "start" | "active";
  readonly errorCode: AbilityStateErrorCode;
}): void {
  const byId = classDefinitionsById(input.classDefs);
  assertUsesMap(input.usesRemaining, input.errorCode);
  assertDistinctMembers(input.members, input.errorCode);
  const expectedIds = new Set<string>();

  for (const member of input.members) {
    const ability = classForMember(member, byId, input.errorCode).battleAbility;
    if (ability === undefined) continue;
    expectedIds.add(member.id);
    assertRemainingUses(
      ownValue(input.usesRemaining, member.id),
      ability.usesPerExpedition,
      member.id,
      input.phase,
      input.errorCode,
    );
  }

  for (const characterId of Reflect.ownKeys(input.usesRemaining)) {
    if (typeof characterId !== "string" || !expectedIds.has(characterId)) {
      invalid(input.errorCode, "현재 파티의 능력 보유자가 아닌 잔여 횟수 키가 있다", {
        characterId: typeof characterId === "symbol" ? characterId.toString() : characterId,
      });
    }
  }
}

function sameAbilityDefinition(
  battleMember: BattlePartyMember,
  classDef: ClassDef,
): boolean {
  const actual = battleMember.battleAbility;
  const expected = classDef.battleAbility;
  return actual !== undefined
    && expected !== undefined
    && actual.kind === expected.kind
    && actual.name === expected.name
    && actual.healTargetMaxHpPercent === expected.healTargetMaxHpPercent
    && actual.usesPerExpedition === expected.usesPerExpedition
    && actual.triggerAtOrBelowHpPercent === expected.triggerAtOrBelowHpPercent;
}

/** 전투 참가자의 결과를 기존 원정 맵 위에 얹어 비참가 사망자 키를 보존한다. */
export function extractBattleAbilityUsesAfterBattle(input: {
  readonly before: BattleAbilityUsesRemaining;
  readonly members: readonly Character[];
  readonly classDefs: readonly ClassDef[];
  readonly battleParty: readonly BattlePartyMember[];
}): BattleAbilityUsesRemaining {
  validateBattleAbilityUses({
    members: input.members,
    classDefs: input.classDefs,
    usesRemaining: input.before,
    phase: "active",
    errorCode: "INVALID_GENERATION",
  });

  const byClassId = classDefinitionsById(input.classDefs);
  const byMemberId = new Map(input.members.map((member) => [member.id, member]));
  const seenBattleIds = new Set<string>();
  const result: Partial<Record<Character["id"], number>> = { ...input.before };

  for (const battleMember of input.battleParty) {
    if (seenBattleIds.has(battleMember.id)) {
      invalid("INVALID_GENERATION", "전투 파티원 ID가 중복된다", { characterId: battleMember.id });
    }
    seenBattleIds.add(battleMember.id);

    const member = byMemberId.get(battleMember.id as Character["id"]);
    if (member === undefined || member.classId !== battleMember.classId) {
      invalid("INVALID_GENERATION", "전투 파티원이 원정 파티와 일치하지 않는다", {
        characterId: battleMember.id,
      });
    }
    const classDef = classForMember(member, byClassId, "INVALID_GENERATION");
    if (classDef.battleAbility === undefined) {
      if (battleMember.battleAbility !== undefined) {
        invalid("INVALID_GENERATION", "능력이 없는 전투원에게 런타임 능력이 있다", {
          characterId: member.id,
        });
      }
      continue;
    }
    if (!sameAbilityDefinition(battleMember, classDef)) {
      invalid("INVALID_GENERATION", "전투원의 런타임 능력이 직업 정의와 일치하지 않는다", {
        characterId: member.id,
      });
    }

    const after = battleMember.battleAbility!.remainingUses;
    const before = input.before[member.id];
    if (before === undefined || after > before) {
      invalid("INVALID_GENERATION", "전투 뒤 능력 잔여 횟수가 증가했다", {
        characterId: member.id,
        before,
        after,
      });
    }
    result[member.id] = after;
  }

  validateBattleAbilityUses({
    members: input.members,
    classDefs: input.classDefs,
    usesRemaining: result,
    phase: "active",
    errorCode: "INVALID_GENERATION",
  });
  return result;
}
