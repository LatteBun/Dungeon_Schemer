import { RuleError, type ClassBattleAbilityDef, type ClassDef } from "@/lib/domain";

function invalid(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function requirePositiveSafeInteger(
  value: number,
  field: string,
  classId: string,
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    invalid(`직업 능력의 ${field}이 양의 안전한 정수가 아니다: ${classId}`, {
      contentType: "classBattleAbility",
      classId,
      field,
      value,
    });
  }
}

function validateBattleAbility(ability: ClassBattleAbilityDef, classId: string): void {
  if (ability.name.trim() === "") {
    invalid(`직업 능력 이름이 비어 있다: ${classId}`, {
      contentType: "classBattleAbility",
      classId,
      field: "name",
    });
  }

  requirePositiveSafeInteger(ability.healAmount, "healAmount", classId);
  requirePositiveSafeInteger(ability.usesPerExpedition, "usesPerExpedition", classId);
  requirePositiveSafeInteger(ability.maxUsesPerBattle, "maxUsesPerBattle", classId);

  if (ability.maxUsesPerBattle > ability.usesPerExpedition) {
    invalid(`직업 능력의 전투당 사용 횟수가 원정당 사용 횟수를 초과한다: ${classId}`, {
      contentType: "classBattleAbility",
      classId,
      maxUsesPerBattle: ability.maxUsesPerBattle,
      usesPerExpedition: ability.usesPerExpedition,
    });
  }

  if (
    !Number.isSafeInteger(ability.triggerAtOrBelowHpPercent) ||
    ability.triggerAtOrBelowHpPercent < 1 ||
    ability.triggerAtOrBelowHpPercent > 100
  ) {
    invalid(`직업 능력의 발동 HP 백분율이 1~100 안전한 정수가 아니다: ${classId}`, {
      contentType: "classBattleAbility",
      classId,
      field: "triggerAtOrBelowHpPercent",
      value: ability.triggerAtOrBelowHpPercent,
    });
  }
}

/** 직업과 선택적 단일 전투 능력 콘텐츠를 검증한다. */
export function validateClasses(classes: readonly ClassDef[]): void {
  const seenIds = new Set<string>();

  for (const classDef of classes) {
    if (seenIds.has(classDef.id)) {
      invalid(`직업 ID가 중복된다: ${classDef.id}`, {
        contentType: "class",
        classId: classDef.id,
      });
    }
    seenIds.add(classDef.id);

    if (classDef.battleAbility !== undefined) {
      validateBattleAbility(classDef.battleAbility, classDef.id);
    }
  }
}
