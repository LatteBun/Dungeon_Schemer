import { RuleError, type ClassBattleAbilityDef, type ClassDef } from "@/lib/domain";

function invalid(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function requirePositiveSafeInteger(
  value: unknown,
  field: string,
  classId: string,
): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    invalid(`직업 능력의 ${field}이 양의 안전한 정수가 아니다: ${classId}`, {
      contentType: "classBattleAbility",
      classId,
      field,
      value,
    });
  }
}

function validateBattleAbility(ability: unknown, classId: string): asserts ability is ClassBattleAbilityDef {
  if (ability === null || typeof ability !== "object" || Array.isArray(ability)) {
    invalid(`직업 능력 정의가 객체가 아니다: ${classId}`, {
      contentType: "classBattleAbility",
      classId,
      value: ability,
    });
  }
  const candidate = ability as Record<string, unknown>;
  if (candidate.kind !== "emergencyHeal") {
    invalid(`지원하지 않는 직업 능력 종류다: ${classId}`, {
      contentType: "classBattleAbility",
      classId,
      field: "kind",
      value: candidate.kind,
    });
  }
  if (typeof candidate.name !== "string" || candidate.name.trim() === "") {
    invalid(`직업 능력 이름이 비어 있다: ${classId}`, {
      contentType: "classBattleAbility",
      classId,
      field: "name",
      value: candidate.name,
    });
  }

  requirePositiveSafeInteger(
    candidate.healTargetMaxHpPercent,
    "healTargetMaxHpPercent",
    classId,
  );
  requirePositiveSafeInteger(candidate.usesPerExpedition, "usesPerExpedition", classId);

  if ((candidate.healTargetMaxHpPercent as number) > 100) {
    invalid("직업 능력의 대상 최대 HP 회복 백분율이 100을 초과한다", {
      contentType: "classBattleAbility",
      classId,
      field: "healTargetMaxHpPercent",
      value: candidate.healTargetMaxHpPercent,
    });
  }

  if (
    typeof candidate.triggerAtOrBelowHpPercent !== "number" ||
    !Number.isSafeInteger(candidate.triggerAtOrBelowHpPercent) ||
    (candidate.triggerAtOrBelowHpPercent as number) < 1 ||
    (candidate.triggerAtOrBelowHpPercent as number) > 100
  ) {
    invalid(`직업 능력의 발동 HP 백분율이 1~100 안전한 정수가 아니다: ${classId}`, {
      contentType: "classBattleAbility",
      classId,
      field: "triggerAtOrBelowHpPercent",
      value: candidate.triggerAtOrBelowHpPercent,
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
