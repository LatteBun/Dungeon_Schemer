import { ADVICE_OUTCOMES, RuleError } from "@/lib/domain";
import type { AdviceOption, SituationEvent } from "@/lib/domain";

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
}
