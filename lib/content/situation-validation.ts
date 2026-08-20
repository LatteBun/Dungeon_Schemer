import { ADVICE_OUTCOMES, RuleError } from "@/lib/domain";
import type { AdviceOption, AdviceOutcome, EcologyRelation, SituationEvent } from "@/lib/domain";

/** 사건 하나가 담는 조언 수. 도움·방해·중립을 한 개씩이다. */
const ADVICE_PER_EVENT = 3;

function invalid(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function requireText(
  value: string,
  message: string,
  details: Record<string, unknown>,
): void {
  if (value.trim() === "") invalid(message, details);
}

function validateAdviceText(option: AdviceOption, eventId: string): void {
  const details = { contentType: "advice", eventId, adviceId: option.id };
  requireText(option.label, `조언 문구가 비어 있다: ${option.id}`, details);
  requireText(option.line, `조언의 근거 대사가 비어 있다: ${option.id}`, details);
  requireText(option.resultText, `조언의 결과 문구가 비어 있다: ${option.id}`, details);
}

/** 테마 전용 사건에서 유형이 요구하는 관계. */
const REQUIRED_RELATION: Readonly<Record<AdviceOutcome, EcologyRelation>> = {
  help: "consistent",
  harm: "contradictory",
  neutral: "unrelated",
};

function validateThemedAdvice(option: AdviceOption, eventId: string): void {
  const details = { contentType: "advice", eventId, adviceId: option.id };
  const required = REQUIRED_RELATION[option.outcome];

  if (option.relation !== required) {
    invalid(`조언 유형과 규칙 관계가 맞지 않는다: ${option.id}`, {
      ...details,
      outcome: option.outcome,
      expected: required,
      actual: option.relation,
    });
  }

  // 정합·모순은 무엇에 대해 정합인지 가리켜야 한다. 무관은 가리킬 것이 없다.
  const needsRule = option.relation !== "unrelated";
  if (needsRule && option.ruleId === undefined) {
    invalid(`참조 규칙이 없다: ${option.id}`, { ...details, relation: option.relation });
  }
  if (!needsRule && option.ruleId !== undefined) {
    invalid(`무관한 조언이 참조 규칙을 갖는다: ${option.id}`, {
      ...details,
      ruleId: option.ruleId,
    });
  }
}

function validateSharedAdvice(option: AdviceOption, eventId: string): void {
  const details = { contentType: "advice", eventId, adviceId: option.id };

  // 공용 사건은 생태 규칙을 참조하지 않는다. 그것이 공용의 정의다.
  if (option.relation !== "unrelated") {
    invalid(`공용 조언의 관계가 무관이 아니다: ${option.id}`, {
      ...details,
      actual: option.relation,
    });
  }
  if (option.ruleId !== undefined) {
    invalid(`공용 조언이 참조 규칙을 갖는다: ${option.id}`, {
      ...details,
      ruleId: option.ruleId,
    });
  }
  // 보스는 테마에 속한다. 모든 테마에 나오는 사건이 특정 보스의 피해를 바꿀 수 없다.
  if (option.bossDamageModifier !== undefined) {
    invalid(`공용 조언이 보스 피해 보정을 갖는다: ${option.id}`, {
      ...details,
      bossDamageModifier: option.bossDamageModifier,
    });
  }
}

function validateAdviceSet(event: SituationEvent): void {
  const details = { contentType: "situationEvent", eventId: event.id };

  if (event.advice.length !== ADVICE_PER_EVENT) {
    invalid(`조언이 ${ADVICE_PER_EVENT}개가 아니다: ${event.id}`, {
      ...details,
      expected: ADVICE_PER_EVENT,
      actual: event.advice.length,
    });
  }

  const seenIds = new Set<string>();
  for (const option of event.advice) {
    if (seenIds.has(option.id)) {
      invalid(`조언 ID가 사건 안에서 중복된다: ${option.id}`, {
        ...details,
        adviceId: option.id,
      });
    }
    seenIds.add(option.id);
    validateAdviceText(option, event.id);
    if (event.theme === undefined) {
      validateSharedAdvice(option, event.id);
    } else {
      validateThemedAdvice(option, event.id);
    }
  }

  // 유형이 정확히 한 개씩인지. 개수만 세면 help 2개 + harm 1개도 3개라 통과한다.
  for (const outcome of ADVICE_OUTCOMES) {
    const count = event.advice.filter((option) => option.outcome === outcome).length;
    if (count !== 1) {
      invalid(`조언 유형 ${outcome}이 한 개가 아니다: ${event.id}`, {
        ...details,
        outcome,
        expected: 1,
        actual: count,
      });
    }
  }
}

function validateUpgrades(event: SituationEvent): void {
  if (event.upgrades === undefined) return;

  for (const upgrade of event.upgrades) {
    const details = {
      contentType: "adviceUpgrade",
      eventId: event.id,
      clueId: upgrade.clueId,
      slotIndex: upgrade.slotIndex,
    };

    if (
      !Number.isInteger(upgrade.slotIndex) ||
      upgrade.slotIndex < 0 ||
      upgrade.slotIndex >= ADVICE_PER_EVENT
    ) {
      invalid(`강화판의 slotIndex가 범위를 벗어난다: ${event.id}`, details);
    }

    const replaced = event.advice[upgrade.slotIndex];
    const replacement = upgrade.replacement;

    // 도움 슬롯을 방해로 바꾸면 각 한 개씩이 깨진다.
    // 단서를 본 플레이어에게만 불변식이 다르게 적용될 이유가 없다.
    if (replacement.outcome !== replaced.outcome) {
      invalid(`강화판의 유형이 교체할 슬롯과 다르다: ${event.id}`, {
        ...details,
        expected: replaced.outcome,
        actual: replacement.outcome,
      });
    }

    validateAdviceText(replacement, event.id);
    if (event.theme === undefined) {
      validateSharedAdvice(replacement, event.id);
    } else {
      validateThemedAdvice(replacement, event.id);
    }
  }
}

/**
 * 조언 콘텐츠 하나가 계약을 만족하는지 검사한다.
 *
 * 수량·문구·태그만 본다. 유형 판정, 수용·의심·적발 확률, 개인별 반응,
 * 보스 피해 보정은 규칙(E2)의 몫이다. 한 던전 안의 중복 방지는 배치(E3)가 한다.
 * docs/systems/INFORMATION_AND_DECEPTION.md
 */
export function validateSituationEvent(event: SituationEvent): void {
  const details = { contentType: "situationEvent", eventId: event.id };
  requireText(event.title, `사건 제목이 비어 있다: ${event.id}`, details);
  requireText(event.description, `사건 묘사가 비어 있다: ${event.id}`, details);
  requireText(
    event.defaultResultText,
    `기본 결과 문구가 비어 있다: ${event.id}`,
    details,
  );
  validateAdviceSet(event);
  validateUpgrades(event);
}
